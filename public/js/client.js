$(function() {
    var ws = new WebSocket('ws://' + window.wsURL);
    var token = null;
    var pt = {};
    var $popover = $('.popover');

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

        switch(e.type) {
            case 'connected':
                token = o.token;
            return;

            case 'manifest':
            return;

            case 'current-artboard':
            case 'artboard':
                if(o.path) {
                    var path = "http://" + window.ip + ":" + window.port + o.path +"?token=" + token + "&t=" + Date.now();
                    $('#app img').attr('src', path);
                }
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