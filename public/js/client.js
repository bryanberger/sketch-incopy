$(function() {
    var ws = new WebSocket('ws://' + window.wsURL);
    var token = null;
    var currentArtboardId = null;
    var pt = {};
    var $popover = $('.popover');
    var pages = {};

    $('#app img').click(function(e) {
        if(token) {
            var offset = $(this).offset();
            var ph = $popover.height();
            var x = e.pageX - offset.left;
            var y = e.pageY - offset.top;
            pt.x = x;
            pt.y = y;

            // hide popover first before deciding to show it
            $popover.hide();

            $.post('/isTextLayerAtPoint', {
                point: {
                    x: x,
                    y: y
                }
            }, function(data) {
                // if there is a text layer at this point, then let us type
                if(data) {
                    $popover
                        .css({
                            'left': x + 'px',
                            'top': (y - (ph / 2) + 20) + 'px'
                        })
                        .show()
                        .find('.txt').focus();
                }
            });
        }
    });

    $popover.find('form').submit(function() {
        var txt = $('.txt').val();

        if(txt) {
            $.post('/updateTextLayer', {
                txt: txt
            }, function() {
                $popover.hide();
                $popover.find('.txt').focus().val('');
            });
        }

        return false;
    });

    ws.onopen = function() {
        performHandshake();
    }

    ws.onmessage = function(e) {
        var e = JSON.parse(e.data);
        var o = e.content;
        var w = 0;
        var h = 0;

        switch(e.type) {
            case 'connected':
                token = o.token;
            return;

            case 'manifest':
                pages = o.contents.pages;
            return;

            case 'current-artboard':
            case 'artboard':
                pages.forEach(function(page) {
                    var artboards = page.artboards;

                    artboards.forEach(function(artboard){
                        if(artboard.id === o.identifier) {
                            w = artboard.width;
                            h = artboard.height;
                            var path = "http://" + window.ip + ":" + window.port + "/artboards/" + artboard.id +"?scale=1&token=" + token + "&t=" + Date.now();
                            $('#app img').attr('src', path).css({width: w, height: h});
                        }
                    });
                });

            return;
        }
    }

    function sendMessage(e) {
        if (!ws) throw new Error("tried to send a message but no websocket");
            ws.send( JSON.stringify(e) );
    }

    function performHandshake() {
        var uuid =  window.sessionStorage.getItem('uuid') || window.uuid;
                    window.sessionStorage.setItem('uuid', uuid);

        sendMessage({
            type: 'device-info',
            challenge: uuid,
            content: {
                uuid: uuid,
                'user-agent': window.navigator.userAgent,
                'display-name': 'Sketch inCopy',
                screens: [{
                    name: 'Browser',
                    scale: window.devicePixelRatio,
                    width: screen.width,
                    height: screen.height
                }]
            }
        })
    }
});
