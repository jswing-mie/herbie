/**
 * Parts of the inspector come from Simple JavaScript DOM Inspector v0.1.2
 * https://github.com/oldprojects/Simple-JavaScript-DOM-Inspector
 */

(function(document) {
	var last;
	var report;
	var done_callback;

	function getLabel(el) {
		var label;

		// If we have a label, our job is easy.
		label = $('label[for="' + el.id ? el.id : '' + '"]');  // this relies on jQuery. the rest of the file appears to be straight JavaScript. why is it here?
		if (label.length===1) {
			return label.text();
		}

		switch (el.tagName) {
			case 'INPUT':
				switch (el.type) {
					case 'checkbox':
						if (el.id==='')
							label = "'" + el.value + "' checkbox";
						else
							label = "'#" + el.id + "' checkbox";
						break;
					case 'text':
						if (el.id==='')
							label = "'" + el.name + "' input";
						else
							label = "'#" + el.id + "' input";
						break;

					default:
						label = cssPath(el);
				}
				break;

			case 'BUTTON':
				label = "'" + el.innerText + "' button";
				break;
			case 'SELECT':
				if (el.id=='')
					label = "'" + el.name + "' dropdown";
				else
					label = "'#" + el.id + "' dropdown";
				break;

			default:
				label = cssPath(el);
		}
		return label;
	}

	function cssPath1(node) {
        var path;
        while (node.length) {
            var realNode = node[0], name = realNode.localName;
            if (!name) break;
            name = name.toLowerCase();

            var parent = node.parentNode;

            var sameTagSiblings = parent.children(name);
            if (sameTagSiblings.length > 1) { 
                allSiblings = parent.children();
                var index = allSiblings.index(realNode) + 1;
                if (index > 1) {
                    name += ':nth-child(' + index + ')';
                }
            }

            path = name + (path ? '>' + path : '');
            node = parent;
        }

        return path;
    }

	/**
	 * Get full CSS path of any element
	 *
	 * Returns a jQuery-style CSS path, with IDs, classes and ':nth-child' pseudo-selectors.
	 *
	 * Can either build a full CSS path, from 'html' all the way to ':nth-child()', or a
	 * more optimised short path, stopping at the first parent with a specific ID,
	 * eg. "#content .top p" instead of "html body #main #content .top p:nth-child(3)"
	 */
	function cssPath(el) {
		var fullPath    = 0,  // Set to 1 to build ultra-specific full CSS-path, or 0 for optimised selector
		    useNthChild = 1,  // Set to 1 to use ":nth-child()" pseudo-selectors to match the given element
		    cssPathStr = '',
		    testPath = '',
		    parents = [],
		    parentSelectors = [],
		    tagName,
		    cssId,
		    cssClass,
		    tagSelector,
		    vagueMatch,
		    nth,
		    i,
		    c;

		while ( el ) {                              // Go up the list of parent nodes and build unique identifier for each:
			vagueMatch = 0;

			tagName = el.nodeName.toLowerCase(); 	      // Get the node's HTML tag name in lowercase
			cssId = ( el.id ) ? ( '#' + el.id ) : false;  // Get node's ID attribute, adding a '#'

			// Get node's CSS classes, replacing spaces with '.':
			cssClass = ( el.className ) ? ( '.' + el.className.replace(/\s+/g,".") ) : '';

			// Build a unique identifier for this parent node:
			if ( cssId ) {                          // Matched by ID:
				tagSelector = tagName + cssId + cssClass;
			} else if ( cssClass ) {                // Matched by class (will be checked for multiples afterwards):
				tagSelector = tagName + cssClass;
			} else {                                // Couldn't match by ID or class, so use ":nth-child()" instead:
				vagueMatch = 1;
				tagSelector = tagName;
			}


			// If using ":nth-child()" selectors and this selector has no ID / isn't the html or body tag:
			if ( useNthChild && !tagSelector.match(/#/) && !tagSelector.match(/^(html|body)$/) ) {

				// If there's no CSS class, or if the semi-complete CSS selector path matches multiple elements:
				if ( !tagSelector.match(/\./) || el.parentElement.childElementCount > 1 ) {

					// Count element's previous siblings for ":nth-child" pseudo-selector:
					for ( nth = 1, c = el; c.previousElementSibling; c = c.previousElementSibling, nth++ );

					// Append ":nth-child()" to CSS path:
					tagSelector += ":nth-child(" + nth + ")";
				}
			}

			parentSelectors.unshift( tagSelector )   // Add this full tag selector to the parentSelectors array:
			
			if ( cssId && !fullPath ) // If doing short/optimised CSS paths and this element has an ID, stop here:
				break;
			el = el.parentNode !== document ? el.parentNode : false;		// Go up to the next parent node
		}

		for (i=0; i<parentSelectors.length; i++)
			cssPathStr += parentSelectors[i] + ' ';

		// Return trimmed full CSS path:
		return cssPathStr.replace(/^[ \t]+|[ \t]+$/, '');
	}


	/**
	 * MouseOver action for all elements on the page:
	 */
	function inspectorMouseOver(e) {
		// Set last selected element so it can be 'deselected' on cancel.
		last = e.target || e.srcElement;

		// Set outline:
		last.style.outline = '2px solid #f00';
		if (report) report.text( "Label: " +  getLabel(last) + ' / ' + cssPath(last));
	}


	/**
	 * MouseOut event action for all elements
	 */
	function inspectorMouseOut(e) {
		// Remove outline from element:
		(e.target || e.srcElement).style.outline = ''; // play nice with IE
	}


	/**
	 * Click action for hovered element
	 */
	function inspectorOnClick(e) {
		var target = e.target || e.srcElement; // e.target is not IE friendly, play nice

		// this was not old IE friendly. (fixed now)
		// jQuery will normalize preventDefault and stopImmediatePropagation
		// but we didn't use jQuery to attach these events
		if (e.preventDefault) {
			e.preventDefault();
		} else {
			e.returnValue = false;
		}
		if (e.stopImmediatePropagation) {
			e.stopImmediatePropagation();
		} else if (e.stopPropagation) {
			e.stopPropagation();
		}

		// These are the default actions (the XPath code might be a bit janky)
		// Really, these could do anything:
		console.log( cssPath(target) );
		console.log( getLabel(target) );
		if (report) report.text(  'Label: ' +  getLabel(target) + ' / ' + cssPath(target));

		/* console.log( getXPath(e.target).join('/') ); */

		inspectorCancel(null);
		return false;
	}


	/**
	 * Function to cancel inspector:
	 */
	function inspectorCancel(e) {
		if (e === null || e.keyCode === 27) {
			// Unbind inspector mouse and click events:
			if (document.detachEvent) {
				document.detachEvent("onmouseover", inspectorMouseOver);
				document.detachEvent("onmouseout", inspectorMouseOut);
				document.detachEvent("onclick", inspectorOnClick);
				document.detachEvent("onkeydown", inspectorCancel);
			} else if (document.removeEventListener) { // Better browsers:
				document.removeEventListener("mouseover", inspectorMouseOver, true);
				document.removeEventListener("mouseout", inspectorMouseOut, true);
				document.removeEventListener("click", inspectorOnClick, true);
				document.removeEventListener("keydown", inspectorCancel, true);
			}

			// If user immediately cancels, last is still undefined
			if (last) {
				// Remove outline on last-selected element:
				last.style.outline = '';
			}
			if (done_callback)  {
				done_callback();
			}
		}
	}


	/**
	 * Add event listeners for DOM-inspectorey actions
	 */
	document.RunInspector = function(div, donefunc) {
		report = div;
		done_callback = donefunc;
		if ( document.addEventListener ) {
			document.addEventListener("mouseover", inspectorMouseOver, true);
			document.addEventListener("mouseout", inspectorMouseOut, true);
			document.addEventListener("click", inspectorOnClick, true);
			document.addEventListener("keydown", inspectorCancel, true);
		} else if ( document.attachEvent ) {
			document.attachEvent("onmouseover", inspectorMouseOver);
			document.attachEvent("onmouseout", inspectorMouseOut);
			document.attachEvent("onclick", inspectorOnClick);
			document.attachEvent("onkeydown", inspectorCancel);
		}
	}
})(document);
