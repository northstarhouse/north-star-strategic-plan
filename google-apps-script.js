/**
 * Google Apps Script for North Star Strategic Plan Tracker
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet (or use an existing one)
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Click "Deploy" > "New deployment"
 * 5. Select type: "Web app"
 * 6. Set "Execute as": "Me"
 * 7. Set "Who has access": "Anyone"
 * 8. Click "Deploy"
 * 9. Copy the Web App URL
 * 10. Paste the URL into GOOGLE_SCRIPT_URL in src/app.jsx
 *
 * OPTIONAL:
 * - If you want to target a specific spreadsheet (not the bound sheet),
 *   set SHEET_ID below to the Google Sheet ID.
 *
 * SHEET STRUCTURE:
 * The script will automatically create the header row on first use.
 * Columns: id, title, focusArea, description, owner, coChampions, status,
 *          progress, targetDate, successMetrics, threeYearVision, annualGoals,
 *          notes, lastUpdateAt, updates, createdAt, updatedAt
 */

const USE_SHEETS = true;
const SHEET_NAME = 'Strategic Plan';
const IMAGE_FOLDER_ID = '';
const IMAGE_FOLDER_NAME = 'North Star Strategic Plan Files';

const DONATIONS_SHEET_ID = '1eGD3TP--yJBv5ISwGFKV3JOmJHCISzZk2jcF7Fuj98s';
const DONATIONS_SHEET_NAME = '2026 Donations';
const SPONSORS_SHEET_ID = '1eGD3TP--yJBv5ISwGFKV3JOmJHCISzZk2jcF7Fuj98s';
const SPONSORS_SHEET_NAME = '2026 Sponsors';
const VOLUNTEERS_SHEET_ID = '1R-rBXFEnqcWXJCAbvpJwXooe-G231tanGYN4GDBv9ZA';
const VOLUNTEERS_SHEET_NAME = '2026 Volunteers';
const EVENTS_SHEET_ID = '1kv2-3cMhzViMr1Fs-SGmiY3DJe05p3r7VIVk5LOj-_k';

const SECTIONS_SHEET_ID = '1jUZzVT5hJ238EhnZt-9N7iLJ7qeJOKKPVczCu_nypPQ';
const SECTION_TABS = [
  'Construction',
  'Grounds',
  'Interiors',
  'Docents',
  'Fund Development',
  'Organizational Development',
  'Venue'
];

// Column headers matching the object schema
const HEADERS = [
  'id',
  'title',
  'focusArea',
  'description',
  'owner',
  'coChampions',
  'status',
  'progress',
  'targetDate',
  'successMetrics',
  'threeYearVision',
  'annualGoals',
  'notes',
  'lastUpdateAt',
  'updates',
  'createdAt',
  'updatedAt'
];

/**
 * Get or create the Strategic Plan sheet
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    const sheets = ss.getSheets();
    if (sheets.length > 0) {
      sheet = sheets[0];
      Logger.log(`Sheet "${SHEET_NAME}" not found. Using first sheet: ${sheet.getName()}`);
    } else {
      sheet = ss.insertSheet(SHEET_NAME);
      // Add headers
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }

  return sheet;
}

/**
 * Get or create the file upload folder in Drive
 */
function getImageFolder() {
  if (IMAGE_FOLDER_ID) {
    return DriveApp.getFolderById(IMAGE_FOLDER_ID);
  }
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(IMAGE_FOLDER_NAME);
}

function getSheetById(sheetId, sheetName) {
  const ss = SpreadsheetApp.openById(sheetId);
  if (!sheetName) return ss.getSheets()[0];
  return ss.getSheetByName(sheetName) || ss.getSheets()[0];
}

function getColumnAValues(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
}

function countNonBlank(values) {
  return values.filter((value) => value !== '' && value !== null && value !== undefined).length;
}

function sumValues(values) {
  return values.reduce((sum, value) => {
    const normalized = String(value).replace(/[^0-9.-]/g, '');
    const number = Number(normalized);
    if (Number.isFinite(number)) return sum + number;
    return sum;
  }, 0);
}

/**
 * Handle GET requests - fetch all initiatives
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getAll') {
      if (!USE_SHEETS) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, objects: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const objects = getAllObjects();
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, objects: objects }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getMetrics') {
      const donationsSheet = getSheetById(DONATIONS_SHEET_ID, DONATIONS_SHEET_NAME);
      const sponsorsSheet = getSheetById(SPONSORS_SHEET_ID, SPONSORS_SHEET_NAME);
      const volunteersSheet = getSheetById(VOLUNTEERS_SHEET_ID, VOLUNTEERS_SHEET_NAME);
      const eventsSheet = getSheetById(EVENTS_SHEET_ID);

      const donationsTotal = sumValues(getColumnAValues(donationsSheet));
      const sponsorsCount = countNonBlank(getColumnAValues(sponsorsSheet));
      const volunteersCount = countNonBlank(getColumnAValues(volunteersSheet));
      const eventsCount = countNonBlank(getColumnAValues(eventsSheet));

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          metrics: {
            donationsTotal,
            sponsorsCount,
            volunteersCount,
            eventsCount
          }
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getSectionSnapshots') {
      const results = {};
      SECTION_TABS.forEach((tabName) => {
        const sheet = getSheetById(SECTIONS_SHEET_ID, tabName);
        const values = sheet.getRange('A1:A4').getValues().flat();
        results[tabName] = {
          area: values[0] || tabName,
          lead: values[1] || '',
          budget: values[2] || '',
          volunteers: values[3] || ''
        };
      });

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, sections: results }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests - create, update, delete
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    let result;

    switch (action) {
      case 'create':
        if (!USE_SHEETS) throw new Error('Sheets disabled');
        result = createObject(data.object);
        break;
      case 'update':
        if (!USE_SHEETS) throw new Error('Sheets disabled');
        result = updateObject(data.object);
        break;
      case 'delete':
        if (!USE_SHEETS) throw new Error('Sheets disabled');
        result = deleteObject(data.id);
        break;
      case 'uploadImage':
        result = uploadImage(data);
        break;
      default:
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
          .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, result: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get all initiatives from the sheet
 */
function getAllObjects() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return []; // Only headers or empty
  }

  const headers = data[0];
  const objects = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      let value = row[j];

      // Parse JSON fields
      if (header === 'updates') {
        try {
          value = value ? JSON.parse(value) : [];
        } catch (e) {
          value = [];
        }
      }

      obj[header] = value;
    }

    // Only include rows with an ID
    if (obj.id) {
      objects.push(obj);
    }
  }

  return objects;
}

/**
 * Create a new initiative
 */
function createObject(obj) {
  const sheet = getSheet();

  // Generate ID if not provided
  if (!obj.id) {
    obj.id = new Date().getTime().toString();
  }

  // Set timestamps
  const now = new Date().toISOString();
  obj.createdAt = obj.createdAt || now;
  obj.updatedAt = now;

  // Create row data
  const rowData = HEADERS.map(header => {
    const value = obj[header];

    // Stringify arrays
    if (header === 'updates') {
      return JSON.stringify(value || []);
    }

    return value || '';
  });

  // Append row
  sheet.appendRow(rowData);

  return obj;
}

/**
 * Update an existing initiative
 */
function updateObject(obj) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  // Find the row with matching ID
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === obj.id) {
      rowIndex = i + 1; // +1 because sheets are 1-indexed
      break;
    }
  }

  if (rowIndex === -1) {
    // Object not found, create it instead
    return createObject(obj);
  }

  // Update timestamp
  obj.updatedAt = new Date().toISOString();

  // Create row data
  const rowData = HEADERS.map(header => {
    const value = obj[header];

    // Stringify arrays
    if (header === 'updates') {
      return JSON.stringify(value || []);
    }

    return value || '';
  });

  // Update row
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowData]);

  return obj;
}

/**
 * Delete an initiative by ID
 */
function deleteObject(id) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  // Find the row with matching ID
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1); // +1 because sheets are 1-indexed
      return { deleted: true, id: id };
    }
  }

  return { deleted: false, id: id, error: 'Not found' };
}

/**
 * Upload a file to Drive and return its public URL
 */
function uploadImage(data) {
  if (!data || !data.data) {
    throw new Error('Missing file data');
  }

  const bytes = Utilities.base64Decode(data.data);
  const mimeType = data.mimeType || 'application/octet-stream';
  const filename = data.filename || 'file';
  const blob = Utilities.newBlob(bytes, mimeType, filename);
  const folder = getImageFolder();
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    id: file.getId(),
    url: `https://drive.google.com/uc?export=view&id=${file.getId()}`,
    name: file.getName()
  };
}

/**
 * Test function - run this to verify the script works
 */
function testScript() {
  // Create a test initiative
  const testObj = {
    title: 'Expand board development program',
    focusArea: 'Organizational Development',
    description: 'Launch quarterly board training and recruitment pipeline.',
    owner: 'Executive Director',
    coChampions: 'Board Chair, Governance Committee',
    status: 'On track',
    progress: 45,
    targetDate: '2026-06-30',
    successMetrics: '100% board seat coverage, quarterly training cadence',
    threeYearVision: 'Board leadership pipeline active, governance cadence steady.',
    annualGoals: 'Finalize recruitment plan, run two trainings, document succession map.',
    notes: 'Align with fundraising strategy',
    updates: [
      {
        id: 'update-1',
        date: new Date().toISOString(),
        author: 'Board Chair',
        summary: 'First training session scheduled',
        details: 'Confirmed facilitation partner and agenda outline.',
        blockers: '',
        nextSteps: 'Finalize invitations',
        progress: 45,
        reviewStatus: 'Pending',
        reviewNotes: ''
      }
    ]
  };

  // Create
  const created = createObject(testObj);
  Logger.log('Created: ' + JSON.stringify(created));

  // Get all
  const all = getAllObjects();
  Logger.log('All objects: ' + JSON.stringify(all));

  // Update
  created.title = 'Updated initiative';
  const updated = updateObject(created);
  Logger.log('Updated: ' + JSON.stringify(updated));

  // Delete
  const deleted = deleteObject(created.id);
  Logger.log('Deleted: ' + JSON.stringify(deleted));
}
