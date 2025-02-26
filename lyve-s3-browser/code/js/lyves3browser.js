/*jslint devel: true, browser: true, unparam: true, vars: true, white: true, passfail: false, nomen: true, maxerr: 50, indent: 4, todo: true */

// This is a global variable of sha1.js and needs to be set for proper b64 encoded string.
b64pad = "="; // needed for "strict RFC compliance"

var LyveS3Browser = function () {
    "use strict";
    var bucket;
    var uploader_container_id;
    var access_key_id;
    var secret_access_key;
    var signature;
    var protocolurl;
    var $login_form;
    var $login_error;
    var $logout_form;
    var $div_logout_form;
    var $bucketlist;
    var $fileupload_field;
    var $div_upload_form;
    var qs;

    var s3url = '.s3.us-east-1.lyvecloud.seagate.com';
    var canned_acl = 'private';
    var policy_document;
    var policy_document_b64;

    var set_signature = function (as) {
            signature = as;
    };

    var set_access_key_id = function (aaki) {
        access_key_id = aaki;
    };

    var set_secret_access_key = function (asak) {
        secret_access_key = asak;
    };

    var set_bucket = function (bn) {
        bucket = bn;
        // Certificate check will fail for bucket names with a dot. Use http for them, https for other buckets.
        if (/\./.exec(bn)) {
            protocolurl = 'http://';
        } else {
            protocolurl = 'https://';
        }
    };

    var set_bucketlist = function (selector) {
        $bucketlist = jQuery(selector);
        // Todo: If not found, alert here.
    };

    var set_fileupload_field = function (selector) {
        $fileupload_field = jQuery(selector);
        // Todo: If not found, alert here.
    };

    var set_div_upload_form = function (selector) {
        $div_upload_form = jQuery(selector);
        // Todo: If not found, alert here.
    };

    var make_policy_document = function () {
        policy_document = '{"expiration": "2020-12-01T12:00:00.000Z", "conditions": [{"acl": "' + canned_acl + '"}, {"bucket": "' + bucket + '"},["starts-with", "$key", ""],["starts-with", "$Content-Type", ""]]}';
        policy_document_b64 = rstr2b64(policy_document);
    };

    var sign_api = function (expires, resource) {
        var http_verb = 'GET';
        var canonicalized_resource = '/' + bucket + resource;
        var string_to_sign = http_verb + "\n\n\n" + expires + "\n" + canonicalized_resource;
        var sig = b64_hmac_sha1(secret_access_key, string_to_sign);
        return sig;
    };

    var location_hash = function (location_hash) {
        var i;
        var result = {};
        if (!location_hash) {
            return result;
        }
        var pairs = location_hash.substring(1).split("&");
        var splitPair;
        for (i=0; i < pairs.length; i++) {
            splitPair = pairs[i].split("=");
            result[decodeURIComponent(splitPair[0])] = decodeURIComponent(splitPair[1]);
        }
        return result;
    };

    var sign = function(secret_access_key, string_to_sign) {
        var sig = b64_hmac_sha1(secret_access_key, string_to_sign);
        return sig;
    };

    var generate_bucket_listing = function (files) {
        var i;
        var out = '<ul class="root">';
        for (i=0; i < files.length; i++) {
            var name = files[i];

            // Skip files that end with a ~
            // Skip files that end with $folder$ (3hub files),
            if (/\$folder\$$/.exec(name) || /~$/.exec(name)) {
                continue;
            }

            var klass = 'file';
            var title = name;
            var url = protocolurl + bucket + s3url;

            var expires = new Date().valueOf();
            expires = parseInt(expires/1000); // milliseconds to seconds
            expires += 21600; // signed request valid for 6 hours
            var signedparamsdata = {'response-cache-control': 'No-cache', 'response-content-disposition': 'attachment'};
            var signedurl = '/' + encodeURIComponent(name) + '?' + jQuery.param(signedparamsdata);
            var signature = sign_api(expires, signedurl);

            var paramsdata = {'AWSAccessKeyId': access_key_id, 'Signature': signature, 'Expires': expires};
            url += signedurl + '&' + jQuery.param(paramsdata);

            out += '<li class="' + klass + '"><a href="' + url + '">' + title + '</a>' + '</li>';
        }
        out += "</ul>";
        $bucketlist.html(out);
    };

    var set_endpoint = function (endpoint) {
        s3url = '.' + endpoint;
    };

    var init_bucketlist = function () {
        var expires = new Date().valueOf();
        expires = parseInt(expires/1000); // milliseconds to seconds
        expires += 21600; // signed request valid for 6 hours
        var signature = sign_api(expires, '/');
        jQuery(function() {
                $.ajax({
                        url: protocolurl + bucket + s3url + '/',
                        data: {'AWSAccessKeyId': access_key_id, 'Signature': signature, 'Expires': expires},
                        dataFormat: 'xml',
                        cache: false,
                        success: function(data) {
                            $login_form.hide();
                            $login_error.hide();
                            $("#logout").show();
                            $bucketlist.show();
                            set_location_hash({'bucket': bucket, 'access_key_id': access_key_id, 'secret_access_key': secret_access_key});
                            $div_upload_form.show();
                            $("#div_login_form").addClass('login');
                            var contents = jQuery(data).find('Contents');
                            var files = [];
                            var i;
                            for (i = 0; i < contents.length; i++) {
                                files.push(jQuery(contents[i]).find('Key').text());
                            }
                            files.sort();
                            generate_bucket_listing(files);
                        },
                        error: function(data) {
                            $login_error.show();
                        }
                    });
            });
    };

    var init_fileupload_field = function () {
        $fileupload_field.fileupload({
                url: protocolurl + bucket + s3url + '/',
                type: 'POST',
                autoUpload: true,
                formData: {
                    key: '${filename}',
                    AWSAccessKeyId: access_key_id,
                    acl: canned_acl,
                    policy: policy_document_b64,
                    signature: signature,
                    'Content-Type': 'application/octet-stream'
                },
                done: function(){ init_bucketlist(); }
            });
    };
    
    var login_form_beforeSubmit = function (formData, jqForm, options) {
        set_bucket(jqForm.find('input[name=bucket]').val());
        make_policy_document();
        set_access_key_id(jqForm.find('input[name=access_key_id]').val());
        set_secret_access_key(jqForm.find('input[name=secret_access_key]').val());
        set_signature(sign(secret_access_key, policy_document_b64));
        init_bucketlist();
        init_fileupload_field();
        return false;
    };

    var init_login_form = function (form_selector, login_error_selector) {
        $login_form = jQuery(form_selector);
        $login_error = jQuery(login_error_selector);
        $login_form.ajaxForm({beforeSubmit: login_form_beforeSubmit});
    };

    var init_logout_form = function (form_selector, div_logout_form_selector) {
        $logout_form = jQuery(form_selector);
        $div_logout_form = jQuery(div_logout_form_selector);
    }

    var init_from_hash = function (arg_hash) {
        qs = location_hash(arg_hash);
        if (qs.bucket) {
            $login_form.find('input[name=bucket]').val(qs.bucket);
        }
        if (qs.access_key_id) {
            $login_form.find('input[name=access_key_id]').val(qs.access_key_id);
        }
        if (qs.secret_access_key) {
            $login_form.find('input[name=secret_access_key]').val(qs.secret_access_key);
        }
    };

    var set_location_hash = function (args) {
        window.location.hash = 'bucket=' + encodeURIComponent(bucket) + '&access_key_id=' + encodeURIComponent(access_key_id) + '&secret_access_key=' + encodeURIComponent(secret_access_key);
    };
        
    var init_autosubmit = function () {
        // Auto-submit form if all 3 params were given in qs
        if (qs.bucket && qs.access_key_id && qs.secret_access_key) {
            $login_form.submit();
        }
    };

    var init_dropzone_effect = function () {
        jQuery(document).bind('dragover', function (e) {
                var dropZone = $div_upload_form,
                timeout = window.dropZoneTimeout;
                if (!timeout) {
                    dropZone.addClass('in');
                } else {
                    clearTimeout(timeout);
                }
                if (e.target === dropZone[0]) {
                    dropZone.addClass('hover');
                } else {
                    dropZone.removeClass('hover');
                }
                window.dropZoneTimeout = setTimeout(function () {
                        window.dropZoneTimeout = null;
                        dropZone.removeClass('in hover');
                }, 100);
        });
    };

    return {
        set_access_key_id: function (args) {
            set_access_key_id(args);
        },
        init: function (args) {
            set_endpoint(args.s3_endpoint);
            init_login_form(args.login_form, args.login_error);
            init_logout_form(args.logout_form, args.div_logout_form);
            init_from_hash(args.hash);
            set_bucketlist(args.bucketlist);
            set_fileupload_field(args.fileupload_field);
            set_div_upload_form(args.div_upload_form);
            init_dropzone_effect();
            init_autosubmit();
        }
    };
};
