# n8n-nodes-doyouok

This is an n8n community node for [Doyouok](https://doyouok.com), a monitor for scheduled jobs.

Add the Doyouok node at the end of a workflow. Doyouok alerts you when:

- the workflow does not run on schedule (a missed or overdue run);
- the workflow runs but its result is wrong, for example "0 rows processed" or a response without "success". This is a silent failure.

You do not need to copy any ping URL. On the first run the node creates a check in Doyouok for the workflow and gets its ping URL. Every run is then sent to Doyouok's ping service. If you rename the workflow, the check's name updates on the next run.

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

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Doyouok](https://doyouok.com)
