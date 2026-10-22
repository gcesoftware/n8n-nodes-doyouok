# n8n-nodes-doyouok

This is an n8n community node for [Doyouok](https://doyouok.com), a monitor for scheduled jobs.

Add the Doyouok node at the end of a workflow. Doyouok alerts you when:

- the workflow does not run on schedule (a missed or overdue run);
- the workflow runs but its result is wrong, for example "0 rows processed" or a response without "success". This is a silent failure.

You do not need to copy any ping URL. On the first run the node creates a check in Doyouok for the workflow and gets its ping URL. Every run is then sent to Doyouok's ping service. If you rename the workflow, the check's name updates on the next run.

Read the [introduction on the Doyouok blog](https://doyouok.com/blog/monitor-n8n-workflows-doyouok-node). Questions? The [help page](https://doyouok.com/n8n-help) has a setup guide, an FAQ and an assistant you can ask.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

**Report Run** sends one report per execution.

- **Check**
  - *This Workflow (Automatic)*: on the first run, the node creates a check linked to this workflow. Set **Expected Every** to how often the workflow should run.
  - *Existing Check*: the node reports to a check you created in Doyouok.
- **Result**
  - *Check Conditions*: every input item must match the conditions, such as `processedCount` is greater than 0 or `result` contains `success`. If any item fails, the run is reported as failed.
  - *Success*: the run is always reported as successful.
  - *Failure*: the run is always reported as failed, for example on an error branch.
- **Options**
  - **Failure Message** is shown in the alert.
  - **Client Name** is required on Agency plans.

The node outputs `checkId`, `name`, `status` and `reason`.

## Credentials

1. Sign in to Doyouok and open **Profile → API tokens**.
2. Create a token and copy it. It is shown only once.
3. In n8n, create a **Doyouok API** credential and paste the token. Leave **Base URL** as `https://doyouok.com`.

## Usage

- Save the workflow before the first run. The check is linked to the workflow's ID.
- A manual test run also counts as a report.
- The node remembers the ping URL in the workflow. It contacts the Doyouok website again only when the name, interval or check changes, or when the check was deleted.
- In Doyouok, the name and interval of a check created by this node are read-only. Change them in n8n instead.

## Example workflow

A nightly import that must run every day and must process at least one row:

```
Schedule Trigger  →  Import Orders (HTTP Request)  →  Doyouok
```

1. **Schedule Trigger**: run every day at 02:00.
2. **Import Orders**: any node that does the work. In this example it is an HTTP Request node that calls your import API and returns `{ "processedCount": 42 }`.
3. **Doyouok** (Report Run):
   - **Check**: *This Workflow (Automatic)*
   - **Expected Every**: `1`, **Unit**: *Days*
   - **Result**: *Check Conditions*
   - **Conditions**: `{{ $json.processedCount }}` (Number) *is greater than* `0`
   - **Options → Failure Message**: `Import processed {{ $json.processedCount }} rows`

Save the workflow and run it once. The check appears in Doyouok with the workflow's name.

What Doyouok reports:

- **The import processed rows**: the run is reported as successful.
- **The import ran but processed 0 rows**: the run is reported as failed and you get an alert with the failure message.
- **The workflow did not run** (n8n was down, the workflow was deactivated, or the import node failed and stopped the workflow): no report arrives, and Doyouok alerts you that the run is overdue.

To report errors at once instead of waiting for the overdue alert, enable **On Error → Continue (using error output)** on the business node and connect its error output to a second Doyouok node with **Result** set to *Failure*.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Doyouok](https://doyouok.com)
* [Doyouok for n8n help and FAQ](https://doyouok.com/n8n-help)
* [Blog: Catch n8n workflows that fail silently](https://doyouok.com/blog/monitor-n8n-workflows-doyouok-node)
