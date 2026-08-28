//! Core types and privacy transforms for API Scenario Patch.
//!
//! The public surface is intentionally small: load a [`Config`], validate it, and
//! transform JSON values with [`redact_json`] or [`substitute_variables`].

use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::net::SocketAddr;
use std::path::Path;
use url::Url;

pub const DEFAULT_CONFIG: &str = r#"# API Scenario Patch records nothing until this reviewed file is used.
version = 1
name = "checkout flow"
upstream = "https://api.example.com"
listen = "127.0.0.1:4317"

[capture]
# Bodies are default-deny. Allow only the route prefixes the patch needs.
request_body_paths = ["/v1/orders"]
response_body_paths = ["/v1/orders"]
# Sensitive headers are always denied, even if listed here.
headers = ["content-type", "x-request-id", "location"]
max_body_bytes = 262144

[[redactions]]
json_path = "$.payment.card_number"
replacement = "${REDACTED_CARD}"

[[extractions]]
name = "order_id"
response_path = "/v1/orders"
json_path = "$.id"

[[notes]]
path = "/v1/orders"
text = "Confirm the id is reused by the following request."

[replay]
# Replay requires this flag AND `asp replay --confirm`.
enabled = false
allowed_hosts = ["api.example.com"]
"#;

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub version: u8,
    pub name: String,
    pub upstream: String,
    #[serde(default = "default_listen")]
    pub listen: String,
    #[serde(default)]
    pub capture: CaptureConfig,
    #[serde(default)]
    pub redactions: Vec<RedactionRule>,
    #[serde(default)]
    pub extractions: Vec<ExtractionRule>,
    #[serde(default)]
    pub notes: Vec<NoteRule>,
    #[serde(default)]
    pub replay: ReplayConfig,
}

fn default_listen() -> String {
    "127.0.0.1:4317".into()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct CaptureConfig {
    pub request_body_paths: Vec<String>,
    pub response_body_paths: Vec<String>,
    pub headers: Vec<String>,
    pub max_body_bytes: usize,
}

impl Default for CaptureConfig {
    fn default() -> Self {
        Self {
            request_body_paths: vec![],
            response_body_paths: vec![],
            headers: vec!["content-type".into(), "location".into()],
            max_body_bytes: 262_144,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RedactionRule {
    pub json_path: String,
    #[serde(default = "default_redaction")]
    pub replacement: String,
}

fn default_redaction() -> String {
    "${REDACTED}".into()
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ExtractionRule {
    pub name: String,
    pub response_path: String,
    pub json_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NoteRule {
    pub path: String,
    pub text: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct ReplayConfig {
    pub enabled: bool,
    pub allowed_hosts: Vec<String>,
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let raw = fs::read_to_string(path)
            .with_context(|| format!("could not read config {}", path.display()))?;
        let config: Self =
            toml::from_str(&raw).with_context(|| format!("invalid TOML in {}", path.display()))?;
        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<()> {
        if self.version != 1 {
            bail!("unsupported config version {}; expected 1", self.version);
        }
        if self.name.trim().is_empty() {
            bail!("scenario name cannot be empty");
        }
        let url = Url::parse(&self.upstream).context("upstream must be a valid URL")?;
        if !matches!(url.scheme(), "http" | "https") {
            bail!("upstream scheme must be http or https");
        }
        if !url.username().is_empty() || url.password().is_some() {
            bail!("upstream must not contain credentials");
        }
        let listen: SocketAddr = self
            .listen
            .parse()
            .context("listen must be an IP socket address")?;
        if !listen.ip().is_loopback() {
            bail!("listen must use a loopback address (127.0.0.1 or ::1)");
        }
        if self.capture.max_body_bytes == 0 || self.capture.max_body_bytes > 1_048_576 {
            bail!("capture.max_body_bytes must be between 1 and 1048576");
        }
        for path in self
            .capture
            .request_body_paths
            .iter()
            .chain(&self.capture.response_body_paths)
        {
            validate_route_prefix(path)?;
        }
        let mut names = std::collections::HashSet::new();
        for rule in &self.redactions {
            parse_json_path(&rule.json_path)?;
            if rule.replacement.is_empty() {
                bail!("redaction replacement cannot be empty");
            }
        }
        for rule in &self.extractions {
            if !names.insert(&rule.name) {
                bail!("duplicate extraction name: {}", rule.name);
            }
            if !is_variable_name(&rule.name) {
                bail!(
                    "invalid extraction name {:?}; use letters, digits, and underscores",
                    rule.name
                );
            }
            validate_route_prefix(&rule.response_path)?;
            parse_json_path(&rule.json_path)?;
        }
        for note in &self.notes {
            validate_route_prefix(&note.path)?;
            if note.text.trim().is_empty() {
                bail!("reviewer note cannot be empty");
            }
        }
        let host = url
            .host_str()
            .ok_or_else(|| anyhow!("upstream must include a host"))?;
        if self.replay.enabled && !self.replay.allowed_hosts.iter().any(|h| h == host) {
            bail!("replay is enabled but upstream host {host:?} is not in replay.allowed_hosts");
        }
        Ok(())
    }

    pub fn upstream_url(&self, path_and_query: &str) -> Result<Url> {
        let base = self.upstream.trim_end_matches('/');
        Url::parse(&format!("{base}{path_and_query}"))
            .context("could not construct upstream request URL")
    }

    pub fn listen_addr(&self) -> Result<SocketAddr> {
        Ok(self.listen.parse()?)
    }
}

fn validate_route_prefix(path: &str) -> Result<()> {
    if !path.starts_with('/') || path.contains('?') || path.contains('#') {
        bail!("route prefix {path:?} must start with / and contain no query or fragment");
    }
    Ok(())
}

fn is_variable_name(name: &str) -> bool {
    !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

pub fn path_allowed(path: &str, prefixes: &[String]) -> bool {
    prefixes.iter().any(|prefix| {
        path == prefix
            || path
                .strip_prefix(prefix)
                .is_some_and(|tail| tail.starts_with('/'))
    })
}

pub fn is_sensitive_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "authorization" | "proxy-authorization" | "cookie" | "set-cookie"
    )
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Segment {
    Key(String),
    Index(usize),
    Wildcard,
}

fn parse_json_path(path: &str) -> Result<Vec<Segment>> {
    if path == "$" {
        return Ok(vec![]);
    }
    let mut rest = path
        .strip_prefix("$.")
        .ok_or_else(|| anyhow!("JSON path {path:?} must start with $."))?;
    let mut result = vec![];
    while !rest.is_empty() {
        let next_dot = rest.find('.').unwrap_or(rest.len());
        let part = &rest[..next_dot];
        if part.is_empty() {
            bail!("JSON path {path:?} has an empty segment");
        }
        if let Some(open) = part.find('[') {
            if !part.ends_with(']') || open == 0 {
                bail!("unsupported JSON path segment {part:?}");
            }
            result.push(Segment::Key(part[..open].to_string()));
            let selector = &part[open + 1..part.len() - 1];
            if selector == "*" {
                result.push(Segment::Wildcard);
            } else {
                result.push(Segment::Index(
                    selector
                        .parse()
                        .context("array index must be a number or *")?,
                ));
            }
        } else {
            result.push(Segment::Key(part.to_string()));
        }
        rest = if next_dot < rest.len() {
            &rest[next_dot + 1..]
        } else {
            ""
        };
    }
    Ok(result)
}

pub fn select_json<'a>(value: &'a Value, path: &str) -> Result<Option<&'a Value>> {
    let segments = parse_json_path(path)?;
    let mut cursor = value;
    for segment in segments {
        cursor = match segment {
            Segment::Key(key) => match cursor.get(&key) {
                Some(v) => v,
                None => return Ok(None),
            },
            Segment::Index(index) => match cursor.get(index) {
                Some(v) => v,
                None => return Ok(None),
            },
            Segment::Wildcard => bail!("wildcards are allowed for redaction but not extraction"),
        };
    }
    Ok(Some(cursor))
}

pub fn redact_json(value: &mut Value, path: &str, replacement: &str) -> Result<usize> {
    let segments = parse_json_path(path)?;
    let replacement = Value::String(replacement.into());
    Ok(replace_at(value, &segments, &replacement))
}

fn replace_at(value: &mut Value, segments: &[Segment], replacement: &Value) -> usize {
    if segments.is_empty() {
        *value = replacement.clone();
        return 1;
    }
    match &segments[0] {
        Segment::Key(key) => value
            .get_mut(key)
            .map_or(0, |child| replace_at(child, &segments[1..], replacement)),
        Segment::Index(index) => value
            .get_mut(*index)
            .map_or(0, |child| replace_at(child, &segments[1..], replacement)),
        Segment::Wildcard => match value.as_array_mut() {
            Some(items) => items
                .iter_mut()
                .map(|item| replace_at(item, &segments[1..], replacement))
                .sum(),
            None => 0,
        },
    }
}

pub fn substitute_variables(value: &mut Value, variables: &HashMap<String, String>) {
    match value {
        Value::String(text) => *text = substitute_text(text, variables),
        Value::Array(items) => items
            .iter_mut()
            .for_each(|item| substitute_variables(item, variables)),
        Value::Object(map) => map
            .values_mut()
            .for_each(|item| substitute_variables(item, variables)),
        _ => {}
    }
}

pub fn substitute_text(text: &str, variables: &HashMap<String, String>) -> String {
    let mut pairs: Vec<_> = variables
        .iter()
        .filter(|(_, value)| !value.is_empty())
        .collect();
    pairs.sort_by(|a, b| b.1.len().cmp(&a.1.len()).then(a.0.cmp(b.0)));
    pairs
        .into_iter()
        .fold(text.to_owned(), |out, (name, value)| {
            out.replace(value, &format!("${{{name}}}"))
        })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scenario {
    pub version: u8,
    pub name: String,
    pub generated_by: String,
    pub replay_enabled: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variables: Vec<VariableDefinition>,
    pub steps: Vec<Step>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableDefinition {
    pub name: String,
    pub from_step: usize,
    pub json_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Step {
    pub number: usize,
    pub request: RecordedRequest,
    pub response: RecordedResponse,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub extracted: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewer_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedRequest {
    pub method: String,
    pub path: String,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub headers: BTreeMap<String, String>,
    pub body: CapturedBody,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedResponse {
    pub status: u16,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub headers: BTreeMap<String, String>,
    pub body: CapturedBody,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum CapturedBody {
    Captured { value: Value },
    Omitted { reason: String },
}

pub fn markdown(scenario: &Scenario) -> String {
    let mut out = format!(
        "# {}\n\n> Generated by `{}`. Replay is disabled in this patch.\n\n",
        scenario.name, scenario.generated_by
    );
    if scenario.steps.is_empty() {
        out.push_str("_No exchanges were recorded._\n");
        return out;
    }
    if !scenario.variables.is_empty() {
        out.push_str("## Variables\n\n");
        for variable in &scenario.variables {
            out.push_str(&format!(
                "- `${{{}}}` — step {}, `{}`\n",
                variable.name, variable.from_step, variable.json_path
            ));
        }
        out.push('\n');
    }
    for step in &scenario.steps {
        out.push_str(&format!(
            "## {}. `{}` `{}`\n\n",
            step.number, step.request.method, step.request.path
        ));
        if let Some(note) = &step.reviewer_note {
            out.push_str(&format!("> Reviewer note: {}\n\n", note.replace('\n', " ")));
        }
        if !step.request.headers.is_empty() {
            out.push_str("Request headers:\n\n```yaml\n");
            out.push_str(&serde_yaml::to_string(&step.request.headers).unwrap_or_default());
            out.push_str("```\n\n");
        }
        out.push_str(&format_body("Request body", &step.request.body));
        out.push_str(&format!("Response: **{}**\n\n", step.response.status));
        if !step.extracted.is_empty() {
            out.push_str(&format!(
                "Extracted: {}\n\n",
                step.extracted
                    .iter()
                    .map(|v| format!("`${{{v}}}`"))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
        out.push_str(&format_body("Observed response body", &step.response.body));
    }
    out
}

fn format_body(label: &str, body: &CapturedBody) -> String {
    match body {
        CapturedBody::Captured { value } => format!(
            "{label}:\n\n```json\n{}\n```\n\n",
            serde_json::to_string_pretty(value).unwrap_or_default()
        ),
        CapturedBody::Omitted { reason } => format!("{label}: _omitted ({reason})_\n\n"),
    }
}

pub fn parse_capture(
    bytes: &[u8],
    allowed: bool,
    max: usize,
    rules: &[RedactionRule],
    variables: &HashMap<String, String>,
) -> CapturedBody {
    if !allowed {
        return CapturedBody::Omitted {
            reason: "path not allowlisted".into(),
        };
    }
    if bytes.len() > max {
        return CapturedBody::Omitted {
            reason: format!("larger than {max} bytes"),
        };
    }
    if bytes.is_empty() {
        return CapturedBody::Captured { value: Value::Null };
    }
    let Ok(mut value) = serde_json::from_slice::<Value>(bytes) else {
        return CapturedBody::Omitted {
            reason: "not a JSON body".into(),
        };
    };
    for rule in rules {
        let _ = redact_json(&mut value, &rule.json_path, &rule.replacement);
    }
    substitute_variables(&mut value, variables);
    CapturedBody::Captured { value }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_valid_and_private() {
        let config: Config = toml::from_str(DEFAULT_CONFIG).unwrap();
        config.validate().unwrap();
        assert!(config.listen_addr().unwrap().ip().is_loopback());
        assert!(!config.replay.enabled);
        assert!(is_sensitive_header("Authorization"));
    }

    #[test]
    fn redacts_wildcards_before_serialization() {
        let mut value =
            serde_json::json!({"items": [{"secret":"one"},{"secret":"two"}], "safe": true});
        assert_eq!(
            redact_json(&mut value, "$.items[*].secret", "${HIDDEN}").unwrap(),
            2
        );
        assert_eq!(value["items"][0]["secret"], "${HIDDEN}");
        assert!(!value.to_string().contains("one"));
    }

    #[test]
    fn extraction_paths_and_substitution_work() {
        let value = serde_json::json!({"data": {"id": "ord_42"}});
        assert_eq!(select_json(&value, "$.data.id").unwrap().unwrap(), "ord_42");
        let vars = HashMap::from([("order_id".into(), "ord_42".into())]);
        assert_eq!(
            substitute_text("/orders/ord_42", &vars),
            "/orders/${order_id}"
        );
    }

    #[test]
    fn allowlist_requires_path_boundary() {
        let rules = vec!["/v1/order".to_string()];
        assert!(path_allowed("/v1/order/123", &rules));
        assert!(!path_allowed("/v1/orders", &rules));
    }

    #[test]
    fn markdown_handles_empty_capture() {
        let scenario = Scenario {
            version: 1,
            name: "Empty".into(),
            generated_by: "asp 0.1.0".into(),
            replay_enabled: false,
            variables: vec![],
            steps: vec![],
        };
        assert!(markdown(&scenario).contains("No exchanges were recorded"));
    }
}
