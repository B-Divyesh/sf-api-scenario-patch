# Copy audit — repair round 3

The landing page was read aloud at 390 px before scrolling. It says the job, the
audience, and the first action in one screen: record API flows for Git review;
small API teams; try the bundled sample.

## Landing sentences

| Words | Sentence | Flag |
| ---: | --- | --- |
| 2 | Offline. | — |
| 7 | The sample and docs are still available. | — |
| 6 | Record API flows for Git review. | — |
| 12 | For small API teams reviewing multi-step requests without a shared API-client workspace. | — |
| 10 | Runs `asp demo` and shows its Markdown and YAML files. | — |
| 6 | Request and response bodies start off. | — |
| 5 | No account or hosted workspace. | — |
| 12 | It records no request or response body until you allow a route. | — |
| 10 | JSON field rules mask values before output files are written. | — |
| 7 | The proxy listens only on this computer. | — |
| 8 | The same sample makes the same scenario patch. | — |
| 8 | Config and command line both must opt in. | — |
| 3 | Run `asp init`. | — |
| 10 | Choose routes, JSON fields to mask, and saved response values. | — |
| 9 | Send your API flow through `asp` on this computer. | — |
| 5 | Keep using your usual API client. | — |
| 10 | Review the Markdown and YAML files with the pull request. | — |
| 18 | A scenario patch puts ordered requests, masked values, saved response values, and notes in Markdown and YAML files. | — |
| 5 | Use a bundled checkout retry. | — |
| 11 | The demo does not contact an API or use your traffic. | — |

All visitor-facing landing sentences are at most 22 words. The banned-word scan
found no matches. Labels such as “Markdown and YAML files”, “Three steps”, and
“Made for pull requests” name their content and are not sentences.

## Terminology

| Concept | One term |
| --- | --- |
| Input | API flow |
| Output | scenario patch |
| Output files | Markdown and YAML files |
| Secret handling | mask / masked value |
| Recording permission | capture rules |
| Response values used later | saved response value |
| Browser or CLI sample | demo |

The configuration key `[[redactions]]` remains a technical name only in the
reference configuration. Visitor copy calls the operation “mask”.
