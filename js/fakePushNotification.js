// https://developer.mozilla.org/en-US/docs/Web/API/notification/Notification
function fakePushNotification() {
    const options = {
        title: 'Notification with Data',
        body:
            'Lorem ipsum dolor sit amet, nec ea errem comprehensam, mei ei aliquam habemus, platonem convenire explicari ut quo. Ad nec zril appareat complectitur. Usu laudem maiorum ei. Duo semper debitis iracundia ad, pri dolor cetero ex. Amet evertitur eam an, no usu velit dolorem persequeris, his movet virtute repudiare ad. At reprimique complectitur nec, erat eripuit dissentiunt sit an.',
        badge: '/images/avatar.jpg',
        image: '/images/99d_logo.png',
        icon:
            'data:image/png;base64,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',
        tag: 'data-notification',
        data: { time: new Date(Date.now()).toString(), message: 'Hello, World!' },
    };

    navigator.serviceWorker
        .getRegistration()
        .then(registration => {
            registration.active.postMessage(options);
        })
        .catch(err => {
            console.log('Service worker registration not found.', err);
        });
}
