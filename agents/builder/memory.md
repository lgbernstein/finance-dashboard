# Builder — Memory Schema

Reads/writes `shared_memory/deployment_log.json`.

## deployment_log.json
```json
{
  "deployments": [
    {
      "timestamp": "ISO datetime",
      "task_id": "uuid",
      "files_changed": [],
      "summary": "string",
      "deploy_status": "local_only | deployed",
      "approved_by": "Larry | auto"
    }
  ]
}
```

Before starting any task, check the last 3 deployments. If a similar change was just made, confirm this isn't a duplicate.
