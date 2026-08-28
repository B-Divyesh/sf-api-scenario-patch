use anyhow::{anyhow, bail, Context, Result};
use api_scenario_patch::{
    is_sensitive_header, markdown, parse_capture, path_allowed, sanitize_path_and_query,
    select_json, substitute_text, CapturedBody, Config, RecordedRequest, RecordedResponse,
    Scenario, Step, VariableDefinition, DEFAULT_CONFIG,
};
use axum::body::{to_bytes, Body};
use axum::extract::State;
use axum::http::{HeaderMap, Request, Response};
use axum::Router;
use clap::{Args, Parser, Subcommand};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::{Mutex, Notify};

const VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_PROXY_BODY_BYTES: usize = 10 * 1024 * 1024;

#[derive(Parser, Debug)]
#[command(name = "asp", version, about = "Record redacted API flows as reviewable Git patches", long_about = None,
    after_help = "Privacy defaults: sensitive headers and query values are denied; bodies require explicit policy.\nExit codes: 0 success, 1 runtime/network failure, 2 invalid input or privacy refusal.")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Write a commented, default-deny configuration file
    Init(InitArgs),
    /// Validate and summarize a configuration without making network calls
    Check(CheckArgs),
    /// Run the loopback reverse proxy and write YAML + Markdown on shutdown
    Record(RecordArgs),
    /// Replay a patch only when config and command line both opt in
    Replay(ReplayArgs),
    /// Write an isolated sample scenario patch in a temporary directory
    Demo(DemoArgs),
}

#[derive(Args, Debug)]
struct InitArgs {
    /// Configuration path to create
    #[arg(long, default_value = "scenario-patch.toml")]
    config: PathBuf,
    /// Replace an existing configuration
    #[arg(long)]
    force: bool,
    /// Emit a machine-readable result
    #[arg(long)]
    json: bool,
}

#[derive(Args, Debug)]
struct CheckArgs {
    /// Reviewed capture policy
    #[arg(long, default_value = "scenario-patch.toml")]
    config: PathBuf,
    /// Emit a machine-readable result
    #[arg(long)]
    json: bool,
}

#[derive(Args, Debug)]
struct RecordArgs {
    /// Reviewed capture policy
    #[arg(long, default_value = "scenario-patch.toml")]
    config: PathBuf,
    /// Output base path; .yml and .md are appended
    #[arg(long, default_value = "scenario")]
    output: PathBuf,
    /// Replace existing output files
    #[arg(long)]
    force: bool,
    /// Accept at most this many successful exchanges; concurrent excess receives 429
    #[arg(long)]
    max_exchanges: Option<usize>,
    /// Emit a machine-readable completion result
    #[arg(long)]
    json: bool,
}

#[derive(Args, Debug)]
struct ReplayArgs {
    /// Scenario YAML produced by `asp record`
    scenario: PathBuf,
    /// Reviewed capture and replay policy
    #[arg(long, default_value = "scenario-patch.toml")]
    config: PathBuf,
    /// Required second opt-in; no interactive prompt is used
    #[arg(long)]
    confirm: bool,
    /// Emit machine-readable results
    #[arg(long)]
    json: bool,
}

#[derive(Args, Debug)]
struct DemoArgs {
    /// Directory for the sample output (a new temporary directory by default)
    #[arg(long)]
    output_dir: Option<PathBuf>,
    /// Emit a machine-readable result
    #[arg(long)]
    json: bool,
}

enum AppError {
    Input(anyhow::Error),
    Runtime(anyhow::Error),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Input(err) | Self::Runtime(err) => write!(f, "{err:#}"),
        }
    }
}

#[tokio::main]
async fn main() -> ExitCode {
    let json_requested = std::env::args_os().any(|arg| arg == "--json");
    let cli = match Cli::try_parse() {
        Ok(cli) => cli,
        Err(error) => {
            if matches!(
                error.kind(),
                clap::error::ErrorKind::DisplayHelp | clap::error::ErrorKind::DisplayVersion
            ) {
                print!("{error}");
                return ExitCode::SUCCESS;
            }
            if json_requested {
                println!(
                    "{}",
                    serde_json::json!({
                        "ok": false,
                        "error": error.to_string(),
                        "kind": "input"
                    })
                );
            } else {
                let _ = error.print();
            }
            return ExitCode::from(2);
        }
    };
    let json_requested = cli.json_requested();
    match run(cli).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            let (kind, code) = match &error {
                AppError::Input(_) => ("input", 2),
                AppError::Runtime(_) => ("runtime", 1),
            };
            if json_requested {
                println!(
                    "{}",
                    serde_json::json!({"ok": false, "error": error.to_string(), "kind": kind})
                );
            } else {
                eprintln!("asp: {error}");
            }
            ExitCode::from(code)
        }
    }
}

impl Cli {
    fn json_requested(&self) -> bool {
        match &self.command {
            Command::Init(args) => args.json,
            Command::Check(args) => args.json,
            Command::Record(args) => args.json,
            Command::Replay(args) => args.json,
            Command::Demo(args) => args.json,
        }
    }
}

async fn run(cli: Cli) -> std::result::Result<(), AppError> {
    match cli.command {
        Command::Init(args) => init(args).map_err(AppError::Input),
        Command::Check(args) => check(args).map_err(AppError::Input),
        Command::Record(args) => record(args).await,
        Command::Replay(args) => replay(args).await,
        Command::Demo(args) => demo(args).map_err(AppError::Runtime),
    }
}

fn demo(args: DemoArgs) -> Result<()> {
    let output_dir = match args.output_dir {
        Some(path) => path,
        None => {
            let nonce = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();
            std::env::temp_dir().join(format!("asp-demo-{}-{nonce}", std::process::id()))
        }
    };
    if output_dir.exists() {
        bail!(
            "demo output directory {} already exists; choose a new --output-dir",
            output_dir.display()
        );
    }
    fs::create_dir_all(&output_dir)
        .with_context(|| format!("could not create demo directory {}", output_dir.display()))?;

    let scenario = sample_scenario();
    let yaml_path = output_dir.join("checkout-flow.yml");
    let markdown_path = output_dir.join("checkout-flow.md");
    atomic_write(&yaml_path, serde_yaml::to_string(&scenario)?.as_bytes())?;
    atomic_write(&markdown_path, markdown(&scenario).as_bytes())?;
    if args.json {
        println!(
            "{}",
            serde_json::json!({
                "ok": true,
                "demo": true,
                "output_dir": output_dir,
                "yaml": yaml_path,
                "markdown": markdown_path,
                "steps": scenario.steps.len()
            })
        );
    } else {
        println!("Demo uses bundled sample data only. Nothing was sent or recorded.");
        println!("Wrote {}", yaml_path.display());
        println!("Wrote {}", markdown_path.display());
    }
    Ok(())
}

fn sample_scenario() -> Scenario {
    Scenario {
        version: 1,
        name: "Checkout retry (sample)".into(),
        generated_by: format!("asp {VERSION} demo"),
        replay_enabled: false,
        variables: vec![VariableDefinition {
            name: "order_id".into(),
            from_step: 1,
            json_path: "$.id".into(),
        }],
        steps: vec![
            Step {
                number: 1,
                request: RecordedRequest {
                    method: "POST".into(),
                    path: "/v1/orders".into(),
                    headers: BTreeMap::from([("content-type".into(), "application/json".into())]),
                    body: CapturedBody::Captured {
                        value: serde_json::json!({"item": "field-notebook", "card_number": "${REDACTED_CARD}"}),
                    },
                },
                response: RecordedResponse {
                    status: 201,
                    headers: BTreeMap::from([("content-type".into(), "application/json".into())]),
                    body: CapturedBody::Captured {
                        value: serde_json::json!({"id": "${order_id}", "state": "created"}),
                    },
                },
                extracted: vec!["order_id".into()],
                reviewer_note: Some("Confirm the order id is reused by the retry.".into()),
            },
            Step {
                number: 2,
                request: RecordedRequest {
                    method: "GET".into(),
                    path: "/v1/orders/${order_id}".into(),
                    headers: BTreeMap::new(),
                    body: CapturedBody::Omitted {
                        reason: "path not allowlisted".into(),
                    },
                },
                response: RecordedResponse {
                    status: 200,
                    headers: BTreeMap::new(),
                    body: CapturedBody::Captured {
                        value: serde_json::json!({"state": "ready"}),
                    },
                },
                extracted: vec![],
                reviewer_note: Some("Retry is intentional after an order handoff.".into()),
            },
        ],
    }
}

fn init(args: InitArgs) -> Result<()> {
    if args.config.exists() && !args.force {
        bail!(
            "{} already exists; use --force to replace it",
            args.config.display()
        );
    }
    atomic_write(&args.config, DEFAULT_CONFIG.as_bytes())?;
    if args.json {
        println!("{}", serde_json::json!({"ok":true,"config":args.config}));
    } else {
        println!(
            "Created {}. Review body allowlists and redactions before recording.",
            args.config.display()
        );
    }
    Ok(())
}

fn check(args: CheckArgs) -> Result<()> {
    let config = Config::load(&args.config)?;
    let upstream = url::Url::parse(&config.upstream)?;
    if args.json {
        println!(
            "{}",
            serde_json::json!({
                "ok": true,
                "name": config.name,
                "upstream_host": upstream.host_str(),
                "listen": config.listen,
                "request_body_routes": config.capture.request_body_paths.len(),
                "response_body_routes": config.capture.response_body_paths.len(),
                "redactions": config.redactions.len(),
                "extractions": config.extractions.len(),
                "replay_enabled": config.replay.enabled
            })
        );
    } else {
        println!("Valid policy: {}", config.name);
        println!(
            "  upstream host: {}",
            upstream.host_str().unwrap_or("<missing>")
        );
        println!("  loopback listener: {}", config.listen);
        println!(
            "  body routes: {} request / {} response",
            config.capture.request_body_paths.len(),
            config.capture.response_body_paths.len()
        );
        println!(
            "  redactions / extractions: {} / {}",
            config.redactions.len(),
            config.extractions.len()
        );
        println!(
            "  replay: {}",
            if config.replay.enabled {
                "enabled with host allowlist"
            } else {
                "disabled"
            }
        );
    }
    Ok(())
}

#[derive(Clone)]
struct ProxyState {
    config: Arc<Config>,
    client: reqwest::Client,
    book: Arc<Mutex<CaptureBook>>,
    next_number: Arc<AtomicUsize>,
    completed: Arc<AtomicUsize>,
    admitted: Arc<AtomicUsize>,
    max_exchanges: Option<usize>,
    stop: Arc<Notify>,
}

struct CaptureBook {
    steps: Vec<Step>,
    variable_values: HashMap<String, String>,
    variables: Vec<VariableDefinition>,
}

async fn record(args: RecordArgs) -> std::result::Result<(), AppError> {
    if args.max_exchanges == Some(0) {
        return Err(AppError::Input(anyhow!(
            "--max-exchanges must be at least 1"
        )));
    }
    let config = Config::load(&args.config).map_err(AppError::Input)?;
    let configured_secrets = config.configured_secrets().map_err(AppError::Input)?;
    let (yaml_path, markdown_path) = output_paths(&args.output);
    if !args.force {
        for path in [&yaml_path, &markdown_path] {
            if path.exists() {
                return Err(AppError::Input(anyhow!(
                    "{} already exists; use --force to replace outputs",
                    path.display()
                )));
            }
        }
    }

    let stop = Arc::new(Notify::new());
    let state = ProxyState {
        config: Arc::new(config.clone()),
        client: reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|e| AppError::Runtime(e.into()))?,
        book: Arc::new(Mutex::new(CaptureBook {
            steps: vec![],
            variable_values: configured_secrets,
            variables: vec![],
        })),
        next_number: Arc::new(AtomicUsize::new(1)),
        completed: Arc::new(AtomicUsize::new(0)),
        admitted: Arc::new(AtomicUsize::new(0)),
        max_exchanges: args.max_exchanges,
        stop: stop.clone(),
    };
    let listener = tokio::net::TcpListener::bind(config.listen_addr().map_err(AppError::Input)?)
        .await
        .map_err(|e| AppError::Runtime(anyhow!("could not bind {}: {e}", config.listen)))?;
    eprintln!(
        "Recording {:?} on http://{} → {}",
        config.name, config.listen, config.upstream
    );
    eprintln!(
        "Bodies are omitted unless their path is allowlisted. Press Ctrl+C to write the patch."
    );

    let app = Router::new().fallback(proxy).with_state(state.clone());
    let stop_for_shutdown = stop.clone();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {},
                _ = stop_for_shutdown.notified() => {},
            }
        })
        .await
        .map_err(|e| AppError::Runtime(e.into()))?;

    let mut book = state.book.lock().await;
    book.steps.sort_by_key(|step| step.number);
    let number_map: HashMap<_, _> = book
        .steps
        .iter()
        .enumerate()
        .map(|(index, step)| (step.number, index + 1))
        .collect();
    for step in &mut book.steps {
        step.number = number_map[&step.number];
    }
    for variable in &mut book.variables {
        variable.from_step = number_map[&variable.from_step];
    }
    book.variables
        .sort_by(|a, b| a.from_step.cmp(&b.from_step).then(a.name.cmp(&b.name)));
    let scenario = Scenario {
        version: 1,
        name: config.name,
        generated_by: format!("asp {VERSION}"),
        replay_enabled: false,
        variables: book.variables.clone(),
        steps: book.steps.clone(),
    };
    let yaml = serde_yaml::to_string(&scenario).map_err(|e| AppError::Runtime(e.into()))?;
    atomic_write(&yaml_path, yaml.as_bytes()).map_err(AppError::Runtime)?;
    atomic_write(&markdown_path, markdown(&scenario).as_bytes()).map_err(AppError::Runtime)?;
    if args.json {
        println!(
            "{}",
            serde_json::json!({"ok":true,"steps":scenario.steps.len(),"yaml":yaml_path,"markdown":markdown_path})
        );
    } else {
        println!(
            "Wrote {} and {} ({} steps).",
            yaml_path.display(),
            markdown_path.display(),
            scenario.steps.len()
        );
    }
    Ok(())
}

async fn proxy(State(state): State<ProxyState>, request: Request<Body>) -> Response<Body> {
    let Some(mut permit) = CapturePermit::try_acquire(&state) else {
        return Response::builder()
            .status(429)
            .header("content-type", "application/json")
            .header("retry-after", "1")
            .body(Body::from(
                serde_json::json!({
                    "error": "capture limit reached",
                    "hint": "start a new recording for additional exchanges"
                })
                .to_string(),
            ))
            .expect("static response is valid");
    };
    match forward_and_capture(state, request).await {
        Ok(response) => {
            permit.commit();
            response
        }
        Err(error) => {
            eprintln!("asp: upstream request failed: {error:#}");
            Response::builder().status(502).header("content-type", "application/json")
                .body(Body::from(serde_json::json!({"error":"upstream request failed","hint":"check the upstream URL and network"}).to_string()))
                .expect("static response is valid")
        }
    }
}

struct CapturePermit {
    admitted: Arc<AtomicUsize>,
    reserved: bool,
    committed: bool,
}

impl CapturePermit {
    fn try_acquire(state: &ProxyState) -> Option<Self> {
        let reserved = if let Some(max) = state.max_exchanges {
            state
                .admitted
                .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |current| {
                    (current < max).then_some(current + 1)
                })
                .is_ok()
        } else {
            false
        };
        (state.max_exchanges.is_none() || reserved).then(|| Self {
            admitted: state.admitted.clone(),
            reserved,
            committed: false,
        })
    }

    fn commit(&mut self) {
        self.committed = true;
    }
}

impl Drop for CapturePermit {
    fn drop(&mut self) {
        if self.reserved && !self.committed {
            self.admitted.fetch_sub(1, Ordering::SeqCst);
        }
    }
}

async fn forward_and_capture(state: ProxyState, request: Request<Body>) -> Result<Response<Body>> {
    let number = state.next_number.fetch_add(1, Ordering::SeqCst);
    let (parts, body) = request.into_parts();
    let request_bytes = to_bytes(body, MAX_PROXY_BODY_BYTES)
        .await
        .context("request body exceeded 10 MiB relay limit")?;
    let path_and_query = parts
        .uri
        .path_and_query()
        .map(|v| v.as_str())
        .unwrap_or("/");
    let url = state.config.upstream_url(path_and_query)?;
    let mut builder = state.client.request(parts.method.clone(), url);
    for (name, value) in &parts.headers {
        if !is_hop_header(name.as_str()) && name.as_str() != "host" {
            builder = builder.header(name, value);
        }
    }
    let upstream = builder.body(request_bytes.clone()).send().await?;
    let status = upstream.status();
    let response_headers = upstream.headers().clone();
    let response_bytes = upstream.bytes().await?;

    let path = parts.uri.path().to_string();
    let mut book = state.book.lock().await;
    let prior_variables = book.variable_values.clone();
    let request_path = sanitize_path_and_query(
        path_and_query,
        &state.config.capture.query_parameters,
        &prior_variables,
    );
    let request_body = parse_capture(
        &request_bytes,
        path_allowed(&path, &state.config.capture.request_body_paths),
        state.config.capture.max_body_bytes,
        &state.config.redactions,
        &prior_variables,
    );

    let raw_json = serde_json::from_slice::<Value>(&response_bytes).ok();
    let mut extracted_names = vec![];
    for rule in &state.config.extractions {
        if path_allowed(&path, std::slice::from_ref(&rule.response_path)) {
            if let Some(value) = raw_json
                .as_ref()
                .and_then(|json| select_json(json, &rule.json_path).ok().flatten())
            {
                if let Some(value) = scalar_string(value) {
                    book.variable_values.insert(rule.name.clone(), value);
                    extracted_names.push(rule.name.clone());
                    if !book.variables.iter().any(|known| known.name == rule.name) {
                        book.variables.push(VariableDefinition {
                            name: rule.name.clone(),
                            from_step: number,
                            json_path: rule.json_path.clone(),
                        });
                    }
                }
            }
        }
    }
    let response_body = parse_capture(
        &response_bytes,
        path_allowed(&path, &state.config.capture.response_body_paths),
        state.config.capture.max_body_bytes,
        &state.config.redactions,
        &book.variable_values,
    );
    let reviewer_note = state
        .config
        .notes
        .iter()
        .filter(|note| path_allowed(&path, std::slice::from_ref(&note.path)))
        .map(|note| note.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let step = Step {
        number,
        request: RecordedRequest {
            method: parts.method.to_string(),
            path: request_path,
            headers: capture_headers(
                &parts.headers,
                &state.config.capture.headers,
                &prior_variables,
            ),
            body: request_body,
        },
        response: RecordedResponse {
            status: status.as_u16(),
            headers: capture_headers(
                &response_headers,
                &state.config.capture.headers,
                &book.variable_values,
            ),
            body: response_body,
        },
        extracted: extracted_names,
        reviewer_note: (!reviewer_note.is_empty()).then_some(reviewer_note),
    };
    book.steps.push(step);
    drop(book);

    let count = state.completed.fetch_add(1, Ordering::SeqCst) + 1;
    if state.max_exchanges.is_some_and(|max| count >= max) {
        state.stop.notify_one();
    }

    let mut outgoing = Response::builder().status(status);
    for (name, value) in &response_headers {
        if !is_hop_header(name.as_str()) && name.as_str() != "content-length" {
            outgoing = outgoing.header(name, value);
        }
    }
    outgoing
        .body(Body::from(response_bytes))
        .context("could not build proxy response")
}

fn capture_headers(
    headers: &HeaderMap,
    allowlist: &[String],
    variables: &HashMap<String, String>,
) -> BTreeMap<String, String> {
    let allowed: std::collections::HashSet<_> =
        allowlist.iter().map(|h| h.to_ascii_lowercase()).collect();
    headers
        .iter()
        .filter_map(|(name, value)| {
            let name = name.as_str().to_ascii_lowercase();
            if is_sensitive_header(&name) || !allowed.contains(&name) {
                return None;
            }
            value
                .to_str()
                .ok()
                .map(|value| (name, substitute_text(value, variables)))
        })
        .collect()
}

fn is_hop_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "connection"
            | "keep-alive"
            | "proxy-authenticate"
            | "proxy-authorization"
            | "te"
            | "trailer"
            | "transfer-encoding"
            | "upgrade"
    )
}

fn scalar_string(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        Value::Bool(value) => Some(value.to_string()),
        _ => None,
    }
}

async fn replay(args: ReplayArgs) -> std::result::Result<(), AppError> {
    if !args.confirm {
        return Err(AppError::Input(anyhow!(
            "replay refused: pass --confirm after reviewing the target and patch"
        )));
    }
    let config = Config::load(&args.config).map_err(AppError::Input)?;
    if !config.replay.enabled {
        return Err(AppError::Input(anyhow!(
            "replay refused: set replay.enabled = true in the reviewed config"
        )));
    }
    let raw = fs::read_to_string(&args.scenario).map_err(|e| AppError::Input(e.into()))?;
    let scenario: Scenario = serde_yaml::from_str(&raw)
        .map_err(|e| AppError::Input(anyhow!("invalid scenario YAML: {e}")))?;
    if scenario.version != 1 {
        return Err(AppError::Input(anyhow!(
            "unsupported scenario version {}",
            scenario.version
        )));
    }
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| AppError::Runtime(e.into()))?;
    let mut variables = HashMap::<String, String>::new();
    let mut results = vec![];
    for step in &scenario.steps {
        let path = resolve_text(&step.request.path, &variables).map_err(AppError::Input)?;
        let url = config.upstream_url(&path).map_err(AppError::Input)?;
        let method = reqwest::Method::from_bytes(step.request.method.as_bytes())
            .map_err(|_| AppError::Input(anyhow!("invalid method in step {}", step.number)))?;
        let mut request = client.request(method, url);
        for (name, value) in &step.request.headers {
            if is_sensitive_header(name) {
                return Err(AppError::Input(anyhow!(
                    "step {} contains a forbidden sensitive header",
                    step.number
                )));
            }
            request = request.header(
                name,
                resolve_text(value, &variables).map_err(AppError::Input)?,
            );
        }
        match &step.request.body {
            CapturedBody::Captured { value } => {
                let resolved = resolve_json(value.clone(), &variables).map_err(AppError::Input)?;
                if !resolved.is_null() {
                    request = request.json(&resolved);
                }
            }
            CapturedBody::Omitted { reason } => {
                return Err(AppError::Input(anyhow!(
                    "step {} request body was omitted ({reason}); replay cannot guess it",
                    step.number
                )))
            }
        }
        let response = request
            .send()
            .await
            .map_err(|e| AppError::Runtime(e.into()))?;
        let status = response.status().as_u16();
        let response_bytes = response
            .bytes()
            .await
            .map_err(|e| AppError::Runtime(e.into()))?;
        if let Ok(json) = serde_json::from_slice::<Value>(&response_bytes) {
            for variable in scenario
                .variables
                .iter()
                .filter(|variable| variable.from_step == step.number)
            {
                if let Some(value) = select_json(&json, &variable.json_path)
                    .map_err(AppError::Input)?
                    .and_then(scalar_string)
                {
                    variables.insert(variable.name.clone(), value);
                }
            }
        }
        results.push(serde_json::json!({"step":step.number,"status":status}));
        if !args.json {
            println!("Step {} → {}", step.number, status);
        }
    }
    if args.json {
        println!("{}", serde_json::json!({"ok":true,"results":results}));
    }
    Ok(())
}

fn resolve_text(text: &str, variables: &HashMap<String, String>) -> Result<String> {
    let mut resolved = text.to_string();
    for (name, value) in variables {
        resolved = resolved.replace(&format!("${{{name}}}"), value);
    }
    if resolved.contains("${") {
        bail!("unresolved placeholder in {text:?}");
    }
    Ok(resolved)
}

fn resolve_json(mut value: Value, variables: &HashMap<String, String>) -> Result<Value> {
    match &mut value {
        Value::String(text) => *text = resolve_text(text, variables)?,
        Value::Array(items) => {
            for item in items {
                *item = resolve_json(item.take(), variables)?;
            }
        }
        Value::Object(map) => {
            for item in map.values_mut() {
                *item = resolve_json(item.take(), variables)?;
            }
        }
        _ => {}
    }
    Ok(value)
}

fn output_paths(base: &Path) -> (PathBuf, PathBuf) {
    let mut stem = base.to_path_buf();
    if matches!(
        stem.extension().and_then(|v| v.to_str()),
        Some("yml" | "yaml" | "md")
    ) {
        stem.set_extension("");
    }
    let mut yaml = stem.clone();
    yaml.set_extension("yml");
    let mut markdown = stem;
    markdown.set_extension("md");
    (yaml, markdown)
}

fn atomic_write(path: &Path, contents: &[u8]) -> Result<()> {
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)
            .with_context(|| format!("could not create {}", parent.display()))?;
    }
    let mut temporary = path.as_os_str().to_os_string();
    temporary.push(format!(".{}.tmp", std::process::id()));
    let temporary = PathBuf::from(temporary);
    fs::write(&temporary, contents)
        .with_context(|| format!("could not write {}", temporary.display()))?;
    fs::rename(&temporary, path)
        .with_context(|| format!("could not finalize {}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_extensions_are_deterministic() {
        assert_eq!(
            output_paths(Path::new("flow.yml")),
            (PathBuf::from("flow.yml"), PathBuf::from("flow.md"))
        );
        assert_eq!(
            output_paths(Path::new("dir/flow")),
            (PathBuf::from("dir/flow.yml"), PathBuf::from("dir/flow.md"))
        );
    }

    #[test]
    fn replay_rejects_unresolved_values() {
        assert!(resolve_text("/orders/${missing}", &HashMap::new()).is_err());
    }

    #[test]
    fn sensitive_headers_never_enter_capture() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", "Bearer secret".parse().unwrap());
        headers.insert("content-type", "application/json".parse().unwrap());
        let captured = capture_headers(
            &headers,
            &["authorization".into(), "content-type".into()],
            &HashMap::new(),
        );
        assert!(!captured.contains_key("authorization"));
        assert_eq!(captured.get("content-type").unwrap(), "application/json");
    }
}
