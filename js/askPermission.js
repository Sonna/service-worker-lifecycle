function askPermission() {
    return new Promise((resolve, reject) => {
        const permissionResult = Notification.requestPermission(result => {
            resolve(result);
        });

        if (permissionResult) {
            permissionResult.then(resolve, reject);
        }
    }).then(permissionResult => {
        console.log('[sw] the current `permissionResult`:', permissionResult);
        if (permissionResult !== 'granted') {
            throw new Error("We weren't granted permission.");
        }
        if (
            !navigator.serviceWorker
                .register('/service-worker.js')
                .then(reg => reg.showNotification)
        ) {
            throw new Error('Service Worker does not support `showNotification()` API');
        }
    });
}
