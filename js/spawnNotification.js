// https://developer.mozilla.org/en-US/docs/Web/API/notification/Notification
function spawnNotification(theBody, theIcon, theTitle) {
    var options = {
        body: theBody,
        icon: theIcon,
    };
    var n = new Notification(theTitle, options);
}
