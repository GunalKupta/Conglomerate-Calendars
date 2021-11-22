let calendar_id;
let shortRange = 10;
let longRange = 200;

let blacklist; // list of calendar IDs that don't need to be shared

let cong_cal = CalendarApp.getCalendarById(calendar_id);

let props = PropertiesService.getScriptProperties();
let active;

function doGet() {
  let html = HtmlService.createHtmlOutputFromFile("Button");
  html.setTitle("Conglomerate Calendars");
  return html;
}

// Remove all existing conglomerate calendar events and copy over
// events from all other owned calendars
function updateCalendar(dayRange) {

  console.log("Updating events for the next " + dayRange + " days");

  setActive(true);
  setProgress(0);
  setProgStatus("Deleting events");

  try{
    // Get date range
    let today = new Date();
    let yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    let endDate = new Date(yesterday.getTime() + (dayRange * 24 * 60 * 60 * 1000));
    console.log("Yesterday: " + yesterday + "\nEnd Date: " + endDate);

    let cong_cal = CalendarApp.getCalendarById(calendar_id);
    console.log(cong_cal.getName());
    let cong_events = cong_cal.getEvents(yesterday, endDate);

    var count = 0;
    
    // Delete all events currently in the conglomerate calendar
    cong_events.forEach(function(cong_event) {
      try {
        cong_event.deleteEvent();
      } catch(e) {
        console.log("Exception: \"" + e.message + "\"\nCooldown at count = " + count + ".\nEvent \"" + cong_event.getTitle() + "\" at " + cong_event.getStartTime().toLocaleString());
        Utilities.sleep(5000);
        cong_event.deleteEvent();
      }
      count++;
      setProgress(count)
    })
    
    console.log("Deleted " + count + " events from conglomerate calendar");
    let totalCount = count;
    
    cals = CalendarApp.getAllOwnedCalendars();
    count = 0;

    setProgStatus("Adding events");

    // Copy each event in date range from each calendar and add to conglomerate calendar
    filterCals(cals).forEach(function(cal) {

      console.log(cal.getName()+"\n"+cal.getId());
      let events = cal.getEvents(yesterday, endDate);
      
      events.forEach(function(event) {
        
        let newTitle = event.getTitle();
        let newDescription = "CALENDAR: " + cal.getName() + (event.getDescription() ? "\n\n" + event.getDescription().trim() : "");
        let creators = event.getCreators();
        if (!(creators.includes("gunalkupta@tamu.edu") || creators.includes("kunalg2019@gmail.com") || creators.includes("kgupta@endeavr.city"))) {
          let ownerEmail = creators[0];
          let owner = event.getGuestByEmail(ownerEmail);
          let creatorStr = (owner && owner.getName()) ? owner.getName() + " (" + creators[0] + ")" : creators.toString();
          newDescription = "CREATOR(S): " + creatorStr + "\n" + newDescription;
        }
        let options = {description: newDescription, location: event.getLocation()};

        try {
          if (event.isAllDayEvent()) {
            cong_cal.createAllDayEvent(newTitle, event.getStartTime(), event.getEndTime(), options)
          } else {
            cong_cal.createEvent(newTitle, event.getStartTime(), event.getEndTime(), options);
          }
        } catch(e) {
          console.log("Exception: \"" + e.message + "\"\nCooldown at count = " + count + ".\nEvent \"" + event.getTitle() + "\" at " + event.getStartTime().toLocaleString());
          Utilities.sleep(5000);
          if (event.isAllDayEvent()) {
            cong_cal.createAllDayEvent(event.getTitle(), event.getStartTime(), event.getEndTime(), options)
          } else {
            cong_cal.createEvent(event.getTitle(), event.getStartTime(), event.getEndTime(), options);
          }
        }

        count++;
        totalCount++;
        setProgress(totalCount);
      })
    });
    console.log("Added " + count + " events to conglomerate calendar");
    props.setProperty("lastRun", new Date());
    
  } catch(e) {
    console.error(e);
  }

  setActive(false)

  return count; 
}

function regularUpdate() {
  let active = isActive()
  console.log("Active? " + active)
  if (active == "true") {
    console.log("Cancelling regular update")
    return;
  }
  return updateCalendar(getShortRange())
}

function weeklyUpdate() {
  waitForInactive();
  updateCalendar(longRange)
}

function getTimeSinceLastExec() {
  let lastExec = new Date(props.getProperty("lastRun"));
  let time = new Date() - lastExec;
  return time/60000;
}

function filterCals(cals) {
  return cals.filter(c => !blacklist.includes(c.getId()));
}

function getProgressMax() {
  let out = getNumCongEventsInDayRange(shortRange)+getNumEventsInDayRange(shortRange);
  return out
}

function setProgress(numEvents) {
  props.setProperty("progress", numEvents.toString());
}
function setProgStatus(message) {
  props.setProperty("progStatus", message)
}
function getProgress() {
  let out = {
    "progress": props.getProperty("progress"),
    "status": props.getProperty("progStatus")
  };
  return out;
}

function getNumCongEventsInDayRange(dayRange) {
  // Get date range
  let today = new Date();
  let endDate = new Date(today.getTime() + (dayRange * 24 * 60 * 60 * 1000));
  console.log("Today: " + today + "\nEnd Date: " + endDate);

  // count events
  let count = cong_cal.getEvents(today, endDate).length;
  return count
}

function deleteCongEvent(cong_event_id) {
  let cong_event = cong_cal.getEventById(cong_event_id);
  try {
      cong_event.deleteEvent();
    } catch(e) {
      console.log("Exception: \"" + e.message + "\"\nCooldown at Event: \"" + cong_event.getTitle() + "\" at " + cong_event.getStartTime().toLocaleString());
      Utilities.sleep(5000);
      cong_event.deleteEvent();
    }
}

function getNumEventsInDayRange(dayRange) {
  let today = new Date();
  let endDate = new Date(today.getTime() + (dayRange * 24 * 60 * 60 * 1000));
  // Copy each event in date range from each calendar and add to conglomerate calendar
  cals = CalendarApp.getAllOwnedCalendars();
  let count = 0;
  filterCals(cals).forEach(function(cal) {
    let events = cal.getEvents(today, endDate);
    count += events.length;
  })
  console.log(count + " events in day range")
  return count;
}

function getAllCals() {
  return CalendarApp.getAllOwnedCalendars().map(function(cal) {
    return cal.getId();
  });
}

function getEventsForCal(cal_id) {
  let today = new Date();
  let endDate = new Date(today.getTime() + (dayRange * 24 * 60 * 60 * 1000));
  let currentCal = CalendarApp.getCalendarById(cal_id);
  console.log(currentCal.getName());
  let events = currentCal.getEvents(today, endDate);
  return events.map(function(event) {
    return event.getId();
  });
}

function deactive() {
  setActive(false)
}

function setActive(a) {
  props.setProperty("active", a.toString())
}
function isActive() {
  return props.getProperty("active");
}
function waitForInactive() {
  let active = isActive();
  while (active == "true") {
    Utilities.sleep(500);
    active = isActive()
  }
  console.log("No longer running")
}

function getShortRange() {
  Logger.log(shortRange)
  return shortRange;
}
