# Webhook Guide for ESPN Player Enrichment

This guide explains how to trigger the enrichment process via webhooks or URLs.

## GitHub Repository
https://github.com/yunikonlabsdevelopment-alt/fanspro-espn-player-enrichment

## Dev Tracking Record
- **Airtable Base**: https://airtable.com/appvOK60xuHCw3Fdz/tblL3VDqpRQxWzYCc/viwzoEJGrzyQA2Vbf
- **Record ID**: rec8oGLTdpOonJ425

## Schedule
- **Frequency**: Weekly on Mondays at 2 AM UTC
- **Cron**: `0 2 * * 1`

## Webhook Trigger Methods

### 1. GitHub Personal Access Token Method

Create a button/automation in Airtable that makes this API call:

```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_GITHUB_PAT" \
  https://api.github.com/repos/yunikonlabsdevelopment-alt/fanspro-espn-player-enrichment/dispatches \
  -d '{"event_type":"enrich-players"}'
```

**Steps to set up:**
1. Go to GitHub Settings → Developer Settings → Personal Access Tokens
2. Create a token with `repo` scope (for private repos) or `public_repo` (for public repos)
3. Use the token in the curl command above

### 2. Airtable Button Field

In Airtable, create a **Button** field with this configuration:

**Button Label**: `Trigger Enrichment`

**URL to open**:
```
https://api.github.com/repos/yunikonlabsdevelopment-alt/fanspro-espn-player-enrichment/dispatches
```

**Note**: Airtable buttons can't send POST requests with headers, so you'll need to use Airtable Automations instead.

### 3. Airtable Automation (Recommended)

Create an Airtable Automation:

**Trigger**: When button clicked (or when record enters view)

**Action**: Run a script
```javascript
// Get your GitHub Personal Access Token from environment or input config
const GITHUB_TOKEN = 'your_github_pat_here';
const REPO_OWNER = 'yunikonlabsdevelopment-alt';
const REPO_NAME = 'fanspro-espn-player-enrichment';

// Trigger the webhook
const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`;

const response = await fetch(url, {
    method: 'POST',
    headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        event_type: 'enrich-players'
    })
});

if (response.status === 204) {
    console.log('✅ Enrichment triggered successfully!');
} else {
    console.log('❌ Failed to trigger enrichment:', response.status);
}
```

### 4. HTML Bookmarklet

Create a browser bookmark with this JavaScript (replace `YOUR_GITHUB_PAT`):

```javascript
javascript:(function(){fetch('https://api.github.com/repos/yunikonlabsdevelopment-alt/fanspro-espn-player-enrichment/dispatches',{method:'POST',headers:{'Accept':'application/vnd.github.v3+json','Authorization':'token YOUR_GITHUB_PAT','Content-Type':'application/json'},body:JSON.stringify({event_type:'enrich-players'})}).then(r=>r.status===204?alert('✅ Enrichment triggered!'):alert('❌ Failed: '+r.status))})();
```

## Event Types

The workflow accepts two event types:

1. **enrich-players** - Process all players in the view
   ```json
   {"event_type": "enrich-players"}
   ```

2. **enrich-single-player** - Process a single player (future enhancement)
   ```json
   {
     "event_type": "enrich-single-player",
     "client_payload": {
       "player_id": "recXXXXXXXXXXXXXX"
     }
   }
   ```

## Monitoring

When triggered, the enrichment will:

1. **Start**: 
   - Update Airtable dev tracking record (rec8oGLTdpOonJ425)
   - Send Slack notification to your webhook
   - Set "Run Status" to "Running"
   - Set "Records Todo" to the count of records
   - Add to "Run Details": `2026-02-09 3:45pm - Running - Records to do (123)`

2. **Complete**:
   - Update "Run Status" to "Complete"
   - Set "Records Todo" to 0
   - Set "Records Done" to processed count
   - Add to "Run Details": `2026-02-09 3:50pm - Complete - Processed 123 records`
   - Send Slack completion notification

3. **On Error**:
   - Send Slack error notification
   - Create Todoist task with error details

## Required GitHub Secrets

Make sure these secrets are set in the GitHub repository:
- `AIRTABLE_TOKEN` - Your Airtable API key
- `AIRTABLE_BASE_ID` - app48HBwrT9Clhd4x
- `AIRTABLE_PLAYERS_TABLE_ID` - tblzqwKvSFUTsUuFt
- `SLACK_WEBHOOK_URL` - Your Slack webhook URL
- `TODOIST_TOKEN` - Your Todoist API token
- `TODOIST_PROJECT_ID` - Your Todoist project ID

## Testing

To test the webhook manually:

```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_GITHUB_PAT" \
  https://api.github.com/repos/yunikonlabsdevelopment-alt/fanspro-espn-player-enrichment/dispatches \
  -d '{"event_type":"enrich-players"}'
```

Check the GitHub Actions tab to see the workflow running.

## Troubleshooting

- **204 response**: Success! Workflow triggered
- **401 Unauthorized**: Check your GitHub PAT token
- **404 Not Found**: Verify repository name and token permissions
- **422 Unprocessable**: Check the event_type spelling

You can also trigger the workflow manually from the GitHub Actions UI by clicking "Run workflow".
