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

All data is extracted from structured **Bio__Item** elements on the bio page for consistency and reliability.

### Basic Information
- **ESPN Team**: Full team name (e.g., "Houston Rockets")
- **ESPN Headshot**: Player headshot image URL
- **ESPN Number**: Jersey number (e.g., "7")
- **ESPN Position**: Playing position (Forward, Guard, Center)
- **ESPN Player Status**: Title case (Active, Out, etc.)

### Career Information
- **ESPN Career Highlights**: Formatted as `YEAR | Award` (one per line)
  - Example: `2024 | All-NBA 1st Team`
- **ESPN Career History**: Formatted as `YEAR | Team` (one per line)
  - Example: `2025 | Houston Rockets`

### Biographical Data
- **ESPN Age**: Current age (e.g., "37")
- **ESPN Height**: Height in centimeters (e.g., "211")
- **ESPN Weight**: Weight in kilograms (e.g., "110")
- **ESPN College**: College/University attended
- **ESPN Birthplace**: City, State/Country (e.g., "Suitland, MD")
- **ESPN Birthdate**: ISO format date (e.g., "1988-09-29")
- **ESPN Draft Info**: Draft details (e.g., "2007: Rd 1, Pk 2 (SEA)")

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
   - Extracts headshot, number, and college (if available)
3. **Extract Bio Page Data** (All fields from structured Bio__Item elements):
   - Navigates to bio page (`/player/bio/_/`)
   - Extracts from labeled Bio__Item elements:
     - Team (full name), Position, HT/WT, Birthdate, Age
     - Draft Info, Birthplace, College
   - Extracts career highlights (formatted: YEAR | Award)
   - Extracts career history (formatted: YEAR | Team)
4. **Format Data**:
   - Converts height to cm (211)
   - Extracts weight as number (110)
   - Formats birthdate to ISO (1988-09-29)
   - Converts status to title case (Active, Out)
5. **Track Changes**: Compares new data against existing Airtable data
6. **Update Status**: 
   - **Updated**: New data differs from existing data
   - **Complete**: No changes detected
   - **Not Found**: 404 error (player page doesn't exist)
   - **Error**: Other errors during extraction
7. **Batch Updates**: Updates Airtable every 10 records to optimize API usage
8. **Detailed Logging**: Tracks specific fields changed in "ESPN Updates" column

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
