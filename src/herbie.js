'use strict';
/*
   This enables ECMAScript 5 strict mode.
   It eliminates poor developer practices and less efficient methods.
   The browser will throw errors in places where bad code used to be allowed.
   One example I just fixed is using a variable in a for loop without declaring it.
*/

(function($) {

var loaderCallback = null;
var stopScript = false;
var h = {}; // local Herbie object for storing element references (more efficient than searching the DOM every time)

window.Herbie = [];

function setHerbieObj() {
	h.parent = $('#herbie_div');
	h.script = h.parent.find('#herbie_script');
	h.output = h.parent.find('#herbie_output');
	h.run = h.parent.find('#herbie_run');
	h.line = h.parent.find('#herbie_line');
	h.inspect = h.parent.find('#herbie_inspect');
	h.add = h.parent.find('#herbie_add');
	h.buttons= h.parent.find('#herbie_buttons');
	h.hide = h.parent.find('#herbie_hide');
	h.parse = h.parent.find('#herbie_parse');
	h.command = h.parent.find('#herbie_command');
	h.window = $(window);
	h.html = $('html');
}

function FindDesc(desc) {
	var el, hadterm=0;

	if (!desc.match(':$')) { // We should first try to find labels ending with a :
		desc += ':';
	} else {
		hadterm = 1;
	}

	try {
		el = $('label').filter(':contains(' +desc+')');
		if (el.length) {
			el = el.first();
			return $('#'+el.attr('for'));  // return the element the label is for
		}
	} catch (ex) {/* purposely empty */}

	desc = desc.slice(0,-1);  // remove the traling :

	try {
		el = $('label').filter(':contains(' +desc+')');
		if (el.length) {
			el = el.first();
			return $('#'+el.attr('for'));  // return the element the label is for
		}
	} catch (ex) {/* purposely empty */}

	if (hadterm) {
		desc += ':';
	}

	try {
		el = $('button').filter(':contains(' +desc+')');  // look for buttons that contain that text.
		if (el.length) {
			return el.first();
		}
	} catch (ex) {/* purposely empty */}

	try {
		el = $('a').filter(':contains(' +desc+')');  // look for buttons that contain that text.
		if (el.length) {
			return el.first();
		}
	} catch (ex) {/* purposely empty */}

	// as a last ditch effort see if it's a path
	try {
		el = $( desc );
	} catch(e) {
		el = [];
	}
	if (el.length===1) {
		return el;
	}

	return [];
}

// This function takes a human readable potentially multi-lined script and turns it into a structured array.
function ParseScript(script) {
	if (!script) {
		return [];
	}

	var lines = script.split('\n');
	var cmdtree = [];
	var i, j;

	for (i = 0; i < lines.length; i++) {  // Go thru each line.

		var cmd = { line: i, code: [], src: lines[i], timeout: 5000 };  // setup cmd structure

		var stmt = lines[i].match(/\w+|'[^']+'|"[^"]+"|\{\{(.*?)\}\}|\*|:/g);   // break the line into words, "quoted" or 'quoted' tokens, and {{tags}}
		if (stmt) {
			if (stmt[0].charAt(0)!=='*') { 					//  We support bulleted lists of field/value pair.  If this is not one, then we process it differently.
				for (j = 0; j < stmt.length; j++) {
					var z = stmt[j].charAt(0);
					if (z === '{' || z === '"' || z === '\'' ) {
						cmd.code.push(stmt[j]);
					} else {
						var candidate = stmt[j].toLowerCase();
						switch (candidate) {
							// verbs
							case 'click':
								cmd.code.push(candidate);
								cmd.code.push('in');
								break;
							case 'type':
							case 'capture':
							case 'test':
							case 'open':
							case 'wait':
							case 'switch':
							case 'navigate':
							case 'press':

							// nouns
							case 'button':
							case 'close':
							case 'autocomplete':
							case 'ok':
							case 'save':
								cmd.code.push(candidate);
								break;
							case 'on':
							case 'in':
							case 'into':
								if ((cmd.code.length) && (cmd.code[ cmd.code.length - 1 ] === 'in')) {
									; // do nothing
								} else {
									cmd.code.push('in');
								}
								break;
						}
					}
				}
			} else {  // this is a field value pair.  ie:  * Field: value
				cmd.code.push('type');
				stmt = lines[i].match(/\*[^:]+|:.+/g);
				// trim is not an IE friendly method, use jQuery.trim() instead
				cmd.code.push(jQuery.trim(stmt[1].slice(1)));
				cmd.code.push('in');
				cmd.code.push(jQuery.trim(stmt[0].slice(1)));
			}
		}
		cmdtree.push(cmd);
	}
	return cmdtree;
}

window.Herbie.StopScript = function() {
	stopScript = true;
};

function ExecuteScript() {
	var cmdtree = arguments[0], options = { line: 0, delay: 100, cmdtree:cmdtree } , callback, tag = [];

	if (arguments.length === 2) { // only two arguments supplied
		if (Object.prototype.toString.call(arguments[1]) === '[object Function]') {
			callback = arguments[1]; // if is a function, set as 'callback'
		} else {
			options = arguments[1]; // if not a function, set as 'options'
		}
	} else if (arguments.length === 3) { // three arguments supplied
		if (arguments[1]) {
			options = arguments[1];
		}
		callback = arguments[2];
	}

	var i=options.line;
	if (i>=cmdtree.length) {
		if (callback) {
			callback(true, options, 'Finished.');
		}
		return;
	}
	if (stopScript) {
		if (callback) {
			callback(true, null, 'Stopped.');
		}
		return;
	}

	var inclause = $.inArray('in', cmdtree[i].code);
	if (inclause !== -1) {
		var tagname = cmdtree[i].code[inclause+1];
		if (tagname.charAt(0)==='"'||tagname.charAt(0)==='\'') {
			tagname = tagname.slice(1,-1);
		}

		tag = FindDesc( tagname );
		if (!tag.length) {
			if (cmdtree[i].timeout>0) {
				cmdtree[i].timeout -= options.delay;
				return setTimeout(function () {
					ExecuteScript(cmdtree,options,callback);
				}, options.delay);
			} else {
				//  If we want to continue on error, we should callback(false), and then schedule the next call.
				if (callback) {
					callback(true, options, 'Aborting. Cannot find tag named: "' + tagname + '"');
				}
				return;
			}
		}
	}

	if (callback) {
		callback(false, options);
	}

	var seq;
	switch (cmdtree[i].code[0]) {
		case 'press':
			seq = cmdtree[i].code[1];
			if (seq.charAt(0)==='"'||seq.charAt(0)==='\'') {
				seq = seq.slice(1,-1);
			}

			if (!tag.length) {
				tag = $( document.activeElement );
			}
			tag.simulate('key-combo', {combo: seq });
			tag.next().focus();
			return setTimeout(function () {
					options.line++; // ok, setting the options to the next line here.
					ExecuteScript(cmdtree,options,callback);
				}, options.delay);

		case 'type':
			seq = cmdtree[i].code[1];
			if (seq.charAt(0)==='"'||seq.charAt(0)==='\'') {
				seq = seq.slice(1,-1);
			}

			if (tag.length) {
				tag.fadeOut(100)
					.fadeIn(100)
					.fadeOut(100)
					.fadeIn(100)
					.simulate('key-sequence', {
						sequence: seq,
						delay: options.delay,
						callback: function () {
							options.line++; // ok, setting the options to the next line here.
							ExecuteScript(cmdtree,options,callback);
						}
					});
			}
			return;
		case 'click':
			if (tag.length) {
				tag.fadeOut(100)
					.fadeIn(100)
					.fadeOut(100)
					.fadeIn(100)
					.simulate('click');
			}
			return setTimeout(function () {
				options.line++; // ok, setting the options to the next line here.
				ExecuteScript(cmdtree,options,callback);
			}, options.delay);

		default:
			return setTimeout(function () {
				options.line++; // ok, setting the options to the next line here.
				ExecuteScript(cmdtree,options,callback);
			}, options.delay);

	}
}

window.Herbie.StartScript = function(opt, progress) {
	if (progress) {
		loaderCallback = progress;
	}
	stopScript = false;

	var script = '';
	var cmdtree = [];
	var options = undefined;
	if (!opt) {
		script = h.script.val();
		cmdtree = ParseScript(script);
	} else if (typeof opt === 'object') {
		script = opt.script;
		cmdtree = ParseScript(script);
		options = { line: opt.line, delay: 100, cmdtree:cmdtree };
	} else {
		script = opt;
		cmdtree = ParseScript(script);
	}

	if (loaderCallback) {
		loaderCallback({
			event: 'starting',
			script: script,
			options: opt
		});
	}

	h.run[0].title = 'Stop';
	h.run[0].innerHTML = '&#xf04d;';

	if (cmdtree.length) {
		ExecuteScript(cmdtree, options, function (done, option, comment) {
			if (h.output.length) {
				if (done) {
					h.run[0].title = 'Run';
					h.run[0].innerHTML = '&#xf04b;';
				}
				if ((option) && (option.line < option.cmdtree.length)) {
					h.line.val(option.line+1);
					h.output.append('Line: ' + (option.line+1) + ', Cmd:' + option.cmdtree[option.line].src + '\n');
				} else if (option) {
					h.line.val('');
				}
				if (comment) {
					h.output.append('[' + comment + ']\n');
				}
				h.output.animate({ scrollTop: h.output[0].scrollHeight}, 10);
			} else {
				console.log(done, option, comment);
			}
			if (loaderCallback) {
				if (done) {
					loaderCallback({
						event: 'done',
						details: option,
						comment: comment
					});
				} else {
					loaderCallback({
						event: 'progress',
						details: option,
						comment: comment
					});
				}
			}
		});
	}
};

window.Herbie.Stop = function() {
	Herbie.StopScript();
	h.parent.hide();
};

function windowResize(e) {
	var pos = h.parent.offset(),
		ww = h.window.width(),
		wh = h.window.height(),
		pw = parseInt(h.parent.css('width')),
		ph = parseInt(h.parent.css('height'));

	if (pos.left <= 0) {
		h.parent.css('left', 0);
	} else if (pos.left + pw > ww) {
		h.parent.css('left', ww - pw);
	}

	if (pos.top <= 0) {
		h.parent.css('top', 0);
	} else if (pos.top + ph > wh) {
		h.parent.css('top', wh - ph);
	}

	// there seems to be a delay between the window resizing and the popup getting repositioned
	// calling the function again fixes this (when necessary)
	if (h.parent.offset().top < 0) {
		windowResize(e);
	}
}

window.Herbie.BuildUI = function(path, script, callback) {
	if (callback) {
		loaderCallback = callback;
	}

	// check to see if it's already in the page.  If it is, then no need to reload it.
	if ($('#herbie_div').show().length) {
		setHerbieOjb();
		if (script) {
			h.script.text(script);
		}
		if (loaderCallback) {
			loaderCallback( { event: 'UIdone'} );
		}
		return;
	}

	$('body').append('<div id="herbie"></div>');
	$('#herbie').load(path+'herbie.html', function() {
		$(this).contents().unwrap();
		setHerbieObj();
		$('#herbie_logo').attr('src',path+'../logos/herbie128.png');
		$('#herbie_text').attr('src',path+'../logos/herbie_text.png');
		$('#herbie_fa').attr('href', path+'../dist/fa/css/font-awesome.min.css');
		if (script) {
			h.script.text(script);
		}

		// window moving
		h.buttons.on('mousedown', function(e) {
			var maxX, maxY, offset, xStart, yStart;

			function htmlmousemove(evt) {
				evt.preventDefault(); // this is IE safe because jQuery normalized it
				h.parent[0].style.left = rangeLimit(evt.pageX - xStart, 0, maxX) + 'px';
				h.parent[0].style.top = rangeLimit(evt.pageY - yStart, 0, maxY) + 'px';
			}

			function htmlmouseup() {
				h.parent.removeClass('herbie_dragging');
				h.html.off({
					'mousemove': htmlmousemove,
					'mouseup': htmlmouseup
				});
			}

			// this only allows the primary mouse button, so I can still right click
			if (e.which === 1  && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
				maxX = rangeLimit(h.window.width() - parseInt(h.parent.css('width')), 0);
				maxY = rangeLimit(h.window.height() - parseInt(h.parent.css('height')), 0);
				offset = h.parent.offset();
				xStart = e.pageX - offset.left;
				yStart = e.pageY - offset.top;

				h.parent.addClass('herbie_dragging');
				h.html.on({
					'mousemove': htmlmousemove,
					'mouseup': htmlmouseup
				});
				e.preventDefault();
			}
		});

		h.hide.on('click', function() {
			switch (this.title) {
				case 'Hide':
					h.parent.removeClass('show_all show_small').addClass('show_hide');
					$(this).html('&#xf078;').attr('title', 'Show');
					break;
				case 'Small':
					h.parent.removeClass('show_hide show_all').addClass('show_small');
					$(this).html('&#xf077;').attr('title', 'Hide');
					break;
				case 'Show':
					h.parent.removeClass('show_hide show_small').addClass('show_all');
					$(this).html('&#xf068;').attr('title', 'Small');
					break;
			}
		});

		h.add.click(function(){
			var txt = h.script.val();

			if (!txt.match(/\n$/)) {
				txt = txt + '\n'; // add a newline;
			}
			txt += h.command.val() + '\n';
			h.script.val(txt);
			h.command.val('').focus();
			if (loaderCallback) {
				loaderCallback({
					event: 'update',
					script: txt
				});
			}
		});

		h.parse.click(function(){
			var cmdtree = ParseScript(h.script.val());
			h.output.text(JSON.stringify(cmdtree,null,2));
		});

		h.run.click(function(){
			switch (this.title) {
			case 'Run':
				h.output.text('');
				Herbie.StartScript({
					script: h.script.val(),
					line: Math.max(Number(h.line.val())-1, 0)
				});
				break;
			case 'Stop':
				Herbie.StopScript();
				break;
			}
		});

		h.inspect.click(function(){
			var current = h.parent[0].className;

			// old IE will run this click plus the click events attached within RunInspector all in a single click.
			// this effectively starts and ends inspection mode in one click
			// using setTimeout causes RunInspector to not run until after the click event has finished
			setTimeout(function() {
				h.parent.removeClass('show_all show_small show_hide').addClass('show_inspect');
				document.RunInspector(h.output, function() {
					h.parent.removeClass('show_inspect').addClass(current);
				});
			}, 1);
		});

		h.window.resize(windowResize);

		// position popup, stop using right:0
		h.parent.css({
			top: 2,
			left: h.window.width() - parseInt(h.parent.css('width')) - 2
		});

		if (loaderCallback) {
			loaderCallback( { event: 'UIdone'} );
		}
	});
};

function rangeLimit(num, min, max) {
	if (num > max) {
		return max;
	} else if (num < min) {
		return min;
	} else {
		return num;
	}
}

})(jQuery);

// fix console.log

if (!console) {
	window.console = {};
}

if (!console.log) {
	console.log = function() {/* do nothing */};
}
