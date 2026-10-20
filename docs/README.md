# Documentation

The repository root [README](../README.md) has setup and local-use instructions. This index separates the supplied source documents from the guides maintained with the application.

## Original specifications

The files in `source/` retain their original contents and names. Read them in this order when checking product behavior or design:

1. [Problem and business rules](source/problem.md)
2. [Product ideation and scope](source/ideation.md)
3. [Technology proposals](source/tech-stack.md)
4. [UI design](source/design.md) and [motion design](source/animations.md)
5. [Implementation reference](source/implementation_reference.md), [phase plan](source/implementation_phases.md), and [original agent guide](source/ai_coding_agent_guide.md)
6. [Requirements traceability](source/requirements_traceability.csv)

These documents describe the original specification. Current delivery and decisions are recorded separately below.

## Maintained project guides

| Area | Files |
|---|---|
| Current state | [Delivery progress](status/progress.md), [original audit and readiness assessment](status/audit-readiness.md) |
| Implementation | [Working decisions](implementation/decision-log.md), [implemented API contracts](implementation/api-contracts.md) |
| Operations | [Local and provisional AWS server guide](operations/self-hosting.md) |

## Reference assets

`refs/design/` contains the supplied visual references. `refs/results/` contains result screenshots and the [manual OCR labels](../refs/results/result-labels.json). The screenshots are local evidence for review and testing; they are not application assets. The application code remains under `apps/` and `packages/`, with tests under `tests/`.
