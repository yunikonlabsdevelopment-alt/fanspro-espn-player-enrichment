# ESPN NBA Player Enrichment

Automated enrichment script that scrapes ESPN player pages and updates Airtable with player data including team, stats, career history, and biographical information.

## Features

- **Comprehensive Data Extraction**: 14 fields including team, position, physical stats, college, career highlights
- **Bio Page Navigation**: Automatically navigates to player bio page for career highlights and history
- **Batch Processing**: Updates Airtable every 10 records to minimize API calls
- **Smart Status Tracking**: Tracks data status (Updated/Complete/Not Found/Error)
- **Detailed Field Tracking**: Records specific fields that changed in each update
- **Error Handling**: Gracefully handles 404s and network errors
- **Automated Scheduling**: Runs weekly via GitHub Actions (Monday 2:00 AM UTC)

## ESPN Page Structure

The script extracts data from two ESPN pages:

1. **Main Player Page**: `https://www.espn.com.au/nba/player/_/id/{ID}/{name}`
   - Team, headshot, status, number, position
   - Bio items (height, weight, age)

2. **Bio Page**: `https://www.espn.com.au/nba/player/bio/_/id/{ID}/{name}`
   - Career highlights (awards and achievements)
   - Career history (team history with years)

## Fields Extracted

### Basic Information
- **ESPN Team**: Current team
- **ESPN Headshot**: Player headshot image URL
- **ESPN Number**: Jersey number
- **ESPN Position**: Playing position
- **ESPN Player Status**: Active/Inactive/Retired status

### Career Information
- **ESPN Career Highlights**: Notable achievements and awards
- **ESPN Career History**: Complete team history

### Biographical Data
- **ESPN Age**: Current age
- **ESPN Height**: Height (ft-in format)
- **ESPN Weight**: Weight in pounds
- **ESPN College**: College/University attended

### Metadata
- **ESPN Data Status**: Updated/Complete/Not Found/Error
- **ESPN Last Check**: ISO date of last enrichment
- **ESPN Updates**: Detailed field-level change tracking

## Configuration

### Airtable Setup
- **Base ID**: `app48HBwrT9Clhd4x` (HB | Data | Sports | Basketball)
- **Table ID**: `tblzqwKvSFUTsUuFt` (Talent)
- **View**: `viwExtQmSJeSQR48C` (ESPN Data)
- **Link Field**: `URL ESPN Link`

### Environment Variables
```bash
AIRTABLE_TOKEN=your_airtable_token
AIRTABLE_BASE_ID=app48HBwrT9Clhd4x
AIRTABLE_PLAYERS_TABLE_ID=tblzqwKvSFUTsUuFt
```

## Installation

```bash
npm install
npm run build
```

## Usage

### Local Development
```bash
# Set environment variables
export AIRTABLE_TOKEN="your_token"
export AIRTABLE_BASE_ID="app48HBwrT9Clhd4x"
export AIRTABLE_PLAYERS_TABLE_ID="tblzqwKvSFUTsUuFt"

# Run the script
npm run dev
```

### Testing
```bash
npm test
```

## Automation

The script runs automatically every Monday at 2:00 AM UTC via GitHub Actions. Configure the following secrets in your GitHub repository:

- `AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_PLAYERS_TABLE_ID`

## Processing Logic

1. **Fetch Records**: Retrieves all records from "ESPN Data" view where "URL ESPN Link" is populated
2. **Extract Main Page Data**: For each player:
   - Navigates to ESPN player page with Puppeteer
   - Waits for page to fully load (networkidle2)
   - Extracts team, headshot, status, number, position
   - Parses bio items (height, weight, age from structured list)
3. **Extract Bio Page Data**:
   - Navigates to bio page (`/player/bio/_/`)
   - Extracts career highlights (awards with years)
   - Extracts career history (teams with tenure)
4. **Track Changes**: Compares new data against existing Airtable data
5. **Update Status**: 
   - **Updated**: New data differs from existing data
   - **Complete**: No changes detected
   - **Not Found**: 404 error (player page doesn't exist)
   - **Error**: Other errors during extraction
6. **Batch Updates**: Updates Airtable every 10 records to optimize API usage
7. **Detailed Logging**: Tracks specific fields changed in "ESPN Updates" column

## Error Handling

- **404 Errors**: Marks status as "Not Found"
- **Network Timeouts**: Continues processing, logs error
- **Missing Selectors**: Logs warning, continues with available data
- **API Errors**: Retries batch update, logs failure

## Development

Built with:
- TypeScript for type safety
- Puppeteer for web scraping
- Airtable API for data management
- GitHub Actions for automation

## License

MIT
