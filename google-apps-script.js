/**
 * ============================================================
 * GOOGLE APPS SCRIPT — Paste this into your Google Sheet's
 * Apps Script editor (Extensions → Apps Script)
 *
 * SETUP STEPS:
 * 1. Create a new Google Sheet (this will store RSVPs)
 * 2. Go to Extensions → Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Click the disk icon to save
 * 5. Run the createPartyEvent() function ONCE (▶ button)
 *    — this creates the calendar event and stores its ID
 *    — you can then edit the event directly in Google Calendar
 *      (change title, time, location, description, etc.)
 *      and all guests will get the update automatically
 * 6. Click "Deploy" → "New deployment"
 * 7. Type = "Web app"
 * 8. Execute as = "Me"
 * 9. Who has access = "Anyone"
 * 10. Click Deploy and authorize when prompted
 * 11. Copy the Web App URL and paste it into script.js
 *     (replace YOUR_APPS_SCRIPT_URL_HERE)
 *
 * IMPORTANT: The first time you deploy, Google will ask you
 * to authorize. Click "Advanced" → "Go to (project name)"
 * → "Allow". This lets the script send calendar invites
 * from your Google account.
 *
 * TO UPDATE EVENT DETAILS:
 * Just edit the event in Google Calendar like normal.
 * All guests who already RSVP'd will see the changes.
 * ============================================================
 */

/**
 * Run this ONCE to create the party event.
 * After running, you'll see the event in your Google Calendar.
 * Edit it there anytime (venue, time, description, etc.)
 */
function createPartyEvent() {
  var props = PropertiesService.getScriptProperties();

  // Check if event already exists
  if (props.getProperty('EVENT_ID')) {
    Logger.log('Event already exists! ID: ' + props.getProperty('EVENT_ID'));
    Logger.log('Edit it directly in Google Calendar.');
    return;
  }

  var calendar = CalendarApp.getDefaultCalendar();
  var event = calendar.createEvent(
    "Xeno's 29th Birthday Karaoke Party 🎤",
    new Date('2026-04-30T19:00:00'),
    new Date('2026-04-30T23:00:00'),
    {
      description: "Join Xeno for a karaoke birthday bash! 🎶🎂\n\nLocation will be confirmed soon.",
      location: 'TBA'
    }
  );

  // Store the event ID so the RSVP handler can find it
  props.setProperty('EVENT_ID', event.getId());
  Logger.log('✅ Event created! ID: ' + event.getId());
  Logger.log('You can now edit this event in Google Calendar anytime.');
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Handle note saving
    if (data.action === 'saveNote') {
      return saveNoteToSheet(data);
    }

    // Otherwise it's an RSVP
    var name = data.name;
    var email = data.email;
    var attending = data.attending;

    // 1. Log to spreadsheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Add headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Name', 'Email', 'Attending', 'Calendar Invite Sent']);
    }

    var calendarSent = 'No';

    // 2. Add guest to the existing calendar event if attending Yes or Maybe
    if (attending === 'Yes' || attending === 'Maybe') {
      try {
        var props = PropertiesService.getScriptProperties();
        var eventId = props.getProperty('EVENT_ID');

        if (!eventId) {
          calendarSent = 'Error: Event not created yet. Run createPartyEvent() first.';
        } else {
          var calendar = CalendarApp.getDefaultCalendar();
          var event = calendar.getEventById(eventId);

          if (!event) {
            calendarSent = 'Error: Event not found. It may have been deleted.';
          } else {
            // Add the guest to the existing event
            event.addGuest(email);
            calendarSent = 'Yes';
          }
        }
      } catch (calError) {
        calendarSent = 'Error: ' + calError.message;
      }
    }

    // Log the RSVP
    sheet.appendRow([
      new Date().toISOString(),
      name,
      email,
      attending,
      calendarSent
    ]);

    // 3. Email you a notification about the RSVP
    try {
      var ownerEmail = Session.getActiveUser().getEmail();
      var subject = '🎤 New RSVP: ' + name + ' (' + attending + ')';
      var body = 'New RSVP for your birthday!\n\n'
        + 'Name: ' + name + '\n'
        + 'Email: ' + email + '\n'
        + 'Attending: ' + attending + '\n'
        + 'Calendar invite sent: ' + calendarSent + '\n'
        + 'Time: ' + new Date().toLocaleString();
      MailApp.sendEmail(ownerEmail, subject, body);
    } catch (mailError) {
      // non-critical — log but don't fail the RSVP
      Logger.log('Mail notification failed: ' + mailError.message);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', calendarSent: calendarSent }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Required for CORS preflight and fetching data
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;

  if (action === 'getNotes') {
    return getNotesFromSheet();
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'RSVP endpoint is live' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== Desktop Notes =====
function saveNoteToSheet(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Notes');
    if (!sheet) {
      sheet = ss.insertSheet('Notes');
      sheet.appendRow(['Timestamp', 'Author', 'Filename', 'Content']);
    }

    var author = (data.author || 'Anonymous').substring(0, 50);
    var filename = (data.filename || 'note.txt').substring(0, 50);
    var content = (data.content || '').substring(0, 2000);

    sheet.appendRow([
      new Date().toISOString(),
      author,
      filename,
      content
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getNotesFromSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Notes');

    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', notes: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    var notes = data.map(function(row) {
      return {
        timestamp: row[0],
        author: row[1],
        filename: row[2],
        content: row[3]
      };
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', notes: notes }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
