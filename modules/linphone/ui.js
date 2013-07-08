/*globals jQuery,linphone,Handlebars,setSlider,PersistentStorage */

linphone.ui = {
	defaultConfiguration: {
		debug: false,
		heartbeat: {
			enabled: true,
			url: 'hb',
			timeout: 5000
		},
		core: {
			running: false
		}
	},
	heartBeatStatus: {
		Undefined: -1,
		Online: 0,
		Offline: 1
	},
	
	/* Main JS helpers */
	getCore: function(target) {
		var ret = linphone.ui.getCoreNull(target);
		if(ret === null) {
			throw "Can't find Core";
		}
		return ret;
	},
	getCoreNull: function(target) {
		var base = linphone.ui.getBase(target);
		var nodes = base.get(0).childNodes;
		
		// jQuery and embedded objects are not friends: use DOM
		for(var i = 0; i < nodes.length; ++i) {
			var node = nodes[i];
			var obj = jQuery(node);
			if(obj.hasClass('core')) {
				return node;
			}
		}
		return null;
	},
	getBase: function(target) {
		if (typeof target === 'undefined') {
			target = jQuery(this);
		}
		if (target.is('.linphoneweb')) {
			return target;
		} else {
			return target.parents('.linphoneweb');
		}
	},

	/* Persistant Part */
	persistent: function(base) {
		return base.data('LinphoneWebPersistent').config;
	},

	/* Configuration Part */ 
	configuration: function(base) {
		return base.data('LinphoneWebConfig');
	},
	
	/* UI Part */
	template: function(base, name, context, jquery) {
		if(typeof jquery === 'undefined') {
			jquery = true;
		}
		var elem;
		var proxy = {
			base: base,
			helpers: linphone.ui.helpers,
			context: context
		};
		if(linphone.ui.configuration(base).debug) {
			name = '#linphone.ui.' + name;
			name = name.replace(/\./g, '\\.');
			var source = jQuery(name).html();
			var template = Handlebars.compile(source);
			elem = template(proxy);
		} else {
			elem = linphone.ui.templates[name](proxy);
		}
		
		if(jquery) {
			elem = jQuery(elem);
			jQuery.i18n.update(elem, true);
		}
		return elem;
	},
	
	slider: function(element) {
		setSlider(element);
	},
	
	init: function(base, config) {
		/* Merge config with default configuration */
		var fconfig = jQuery.extend(true, {}, linphone.ui.defaultConfiguration);
		jQuery.extend(fconfig, config);
		base.data('LinphoneWebConfig', fconfig);
		
		/* Get persistent storage */
		base.data('LinphoneWebPersistent', new PersistentStorage(fconfig.name, {}, 10000, fconfig.debug));
		
		jQuery.fn.disableSelection = function() {
			return this.each(function() {
				jQuery(this).attr('unselectable', 'on').css({
					'-moz-user-select' : 'none',
					'-webkit-user-select' : 'none',
					'user-select' : 'none',
					'-ms-user-select' : 'none'
				}).each(function() {
					this.onselectstart = function() {
						return false;
					};
				});
			});
		};
		
		jQuery.fn.mouseenternear = function(fct, distance) {
			if(typeof distance === 'undefined') {
				distance = 0;
			}
			var that = this;
			function isNear( element, distance, event ) {
				var left = element.offset().left - distance,
				top = element.offset().top - distance,
				right = left + element.width() + 2*distance,
				bottom = top + element.height() + 2*distance,
				x = event.pageX,
				y = event.pageY;

				return ( x > left && x < right && y > top && y < bottom );
			}
			function wrapper() {
				var old_in = false;
				jQuery('body').mousemove(function(event) {
					var new_in = isNear(that, distance, event);
					if(!old_in && new_in) {
						fct(event);
					}
					old_in = new_in;
				});
			}
			return wrapper();
		};
		
		jQuery.fn.mouseleavenear = function(fct, distance) {
			if(typeof distance === 'undefined') {
				distance = 0;
			}
			var that = this;
			function isNear(element, distance, event) {
				var left = element.offset().left - distance,
				top = element.offset().top - distance,
				right = left + element.width() + 2*distance,
				bottom = top + element.height() + 2*distance,
				x = event.pageX,
				y = event.pageY;
		
				return ( x > left && x < right && y > top && y < bottom );
			}
			function wrapper () {
				var old_in = false;
				jQuery('body').mousemove(function(event) {
					var new_in = isNear(that, distance, event);
					if(old_in && !new_in) {
						fct(event);
					}
					old_in = new_in;
				});
			}
			return wrapper();
		};
		
		jQuery.fn.visible = function() {
			return this.css('visibility', 'visible');
		};
		jQuery.fn.invisible = function() {
			return this.css('visibility', 'hidden');
		};
		jQuery.fn.isOrParent = function(selector) {
			return this.is(selector) || this.parent(selector).length !== 0;
		};
		jQuery.fn.isOrParents = function(selector) {
			return this.is(selector) || this.parents(selector).length !== 0;
		};
		jQuery.fn.getSelfAndParent = function(selector) {
			return this.parent('*').andSelf().filter(selector);
		};
		jQuery.fn.getSelfAndParents = function(selector) {
			return this.parents('*').andSelf().filter(selector);
		};
		
		// Use linphone.ui as linphone.ui.helpers
		linphone.ui.helpers = linphone.ui;
		
		// Helpers		
		Handlebars.registerHelper('LinphoneWeb-Call', function(fct) {
			return fct.apply(this, [this.base].concat(Array.prototype.slice.call(arguments, 1)));
		});
		
		linphone.ui.exceptionHandler(base, function() {
			linphone.ui.uiInit(base);
			linphone.ui.core.init(base);
			linphone.ui.video.init(base);
			linphone.ui.locale.init(base);
			linphone.ui.header.init(base);
			linphone.ui.menu.init(base);
			linphone.ui.mainbar.init(base);
			linphone.ui.dialer.init(base);
			linphone.ui.view.init(base);
			linphone.ui.popup.init(base);
			
			// Update locale
			linphone.ui.locale.update(base);
		})();

		// Run heartbeat
		if(linphone.ui.configuration(base).heartbeat.enabled) {
			linphone.ui.startHeartBeat(base);
		}

		// Call callback
		base.on('callStateChanged', linphone.ui.onCallStateChanged); 
		base.on('networkStateChanged', linphone.ui.onNetworkStateChanged);
	},
	uiInit: function(base) {
		// Disable selection on buttons
		base.find('.button').disableSelection();
	},
	translate: function(base) {
		linphone.ui.locale.translate(base);
		linphone.ui.header.translate(base);
		linphone.ui.menu.translate(base);
		linphone.ui.mainbar.translate(base);
		linphone.ui.dialer.translate(base);
		linphone.ui.view.translate(base);
		linphone.ui.popup.translate(base);
	},
	
	/* */
	login: function(base, force) {
		// Update configuration
		var configuration = linphone.ui.configuration(base);
		
		configuration.login = true;
		
		linphone.ui.mainbar.show(base);
		if((!configuration.login && typeof force === 'undefined') || force) {
			linphone.ui.popup.clear(base);
			linphone.ui.view.show(base, 'main');
		}
	},
	logout: function(base) {
		// Update configuration
		var configuration = linphone.ui.configuration(base);
		
		linphone.ui.mainbar.hide(base);
		if(configuration.login) {
			linphone.ui.popup.clear(base);
			linphone.ui.view.show(base, 'login');
		}
		
		configuration.login = false;
	},
	isLogged: function(base) {
		var configuration = linphone.ui.configuration(base);
		return configuration.login;
	},
	reset: function (base) {
		base.find('> .content .loading').show();
		base.find('> .header .settings').addClass('disabled');
		linphone.ui.view.show(base, 'empty');
		linphone.ui.mainbar.hide(base);
		linphone.ui.menu.hide(base);
	},
	
	/* Heartbeat functions */
	startHeartBeat: function(base) {
		var heartbeat = linphone.ui.configuration(base).heartbeat;
		if(!heartbeat.running) {
			heartbeat.status = linphone.ui.heartBeatStatus.Undefined;
			heartbeat.running = true;
			linphone.ui.heartBeat(base, heartbeat);
		}
	},
	stopHeartBeat: function(base) {
		var heartbeat = linphone.ui.configuration(base).heartbeat;
		if(heartbeat.running) {
			heartbeat.running = false;
			if(heartbeat.__timeout) {
				// Reset timer
				var timeout = heartbeat.__timeout;
				heartbeat.__timeout = null;
				window.clearInterval(timeout);
			}
		}
	},
	getHeartBeatStatus: function(base) {
		var heartbeat = linphone.ui.configuration(base).heartbeat;
		return heartbeat.status;
	},
	isHeartBeatRunning: function(base) {
		var heartbeat = linphone.ui.configuration(base).heartbeat;
		return heartbeat.running;
	},
	heartBeat: function(base, heartbeat) {
		linphone.ui.logger.debug(base, "Hearbeat");
		jQuery.ajax(heartbeat.url, {
			cache: false,
			timeout: heartbeat.timeout
		}).done(function(data){
			if(heartbeat.status !== linphone.ui.heartBeatStatus.Online) {
				heartbeat.status = linphone.ui.heartBeatStatus.Online;
				linphone.ui.logger.debug(base, "Network status changed: Online");
				linphone.ui.exceptionHandler(base, function() {
					base.trigger('networkStateChanged', [linphone.ui.heartBeatStatus.Online]);
				})();
			}
			linphone.ui._heartBeat(base);
		}).error(function(jqXHR, textStatus, errorThrown) {
			if(heartbeat.status !== linphone.ui.heartBeatStatus.Offline) {
				heartbeat.status = linphone.ui.heartBeatStatus.Offline;
				linphone.ui.logger.debug(base, "Network status changed: Offline");
				linphone.ui.exceptionHandler(base, function() {
					base.trigger('networkStateChanged', [linphone.ui.heartBeatStatus.Offline]);
				})();
			}
			linphone.ui._heartBeat(base);
		});
	},
	_heartBeat: function(base) {
		var heartbeat = linphone.ui.configuration(base).heartbeat;
		heartbeat.__timeout = window.setTimeout(function() {
			// Reset timer
			var timeout = heartbeat.__timeout;
			heartbeat.__timeout = null;
			window.clearInterval(timeout);
			
			linphone.ui.heartBeat(base, heartbeat);
		}, heartbeat.timeout);
	},
	onNetworkStateChanged: function(event, status) {
		/*
		var base = jQuery(this);
		if(status === linphone.ui.heartBeatStatus.Online) {
			base.find('> .content .offline').hide();
		} else {
			base.find('> .content .offline').show();
		}
		*/
	},
	
	/* Call state */
	onCallStateChanged: function(event, call, state, message) {
		var base = jQuery(this);
		window.console.log(state);
		var core = linphone.ui.getCore(base);
		if(state === linphone.core.enums.callState.IncomingReceived){
			linphone.ui.popup.incall.show(base, call);
		}
		if(state === linphone.core.enums.callState.Connected){
			linphone.ui.popup.incall.hide(base, call);
			linphone.ui.view.show(base, 'call', call);
		}
		if(state === linphone.core.enums.callState.End){
			linphone.ui.popup.incall.hide(base, call);
			linphone.ui.view.call.terminateCall(base, call);
			linphone.ui.view.hide(base, 'call');
		}
	},
	
	/* Error handling */
	exceptionHandler: function (base, fct) {
		return function(args) {
			if(linphone.ui.configuration(base).debug) {
				fct.apply(this, arguments);
			} else {
				try {
					fct.apply(this, arguments);
				} catch (error) {
					linphone.ui.error(base, 'errors.exception.unhandled');
				}
			}
		};
	},
	error: function (base, error_id, error) {
		base.find('> .content .loading').hide();
		linphone.ui.view.show(base, 'error', error_id, error);
	},
	
	isValid: function(base) {
		return typeof base !== 'undefined' && base !== null;
	},
	
	/* Logging functions */
	logger: {
		log: function(base, message) {
			var config = {debug: true};
			if(base) {
				config = linphone.ui.configuration(base);
			}
			if (config.debug && typeof window.console !== 'undefined') {
				window.console.log(message);
			}
		},
		warn: function(base, message) {
			var config = {debug: true};
			if(base) {
				config = linphone.ui.configuration(base);
			}
			if (config.debug && typeof window.console !== 'undefined') {
				window.console.warn(message);
			}
		},
		error: function(base, message) {
			var config = {debug: true};
			if(base) {
				config = linphone.ui.configuration(base);
			}
			if (config.debug && typeof window.console !== 'undefined') {
				window.console.error(message);
			}
		},
		info: function(base, message) {
			var config = {debug: true};
			if(base) {
				config = linphone.ui.configuration(base);
			}
			if (config.debug && typeof window.console !== 'undefined') {
				window.console.info(message);
			}
		},
		debug: function(base, message) {
			var config = {debug: true};
			if(base) {
				config = linphone.ui.configuration(base);
			}
			if (config.debug && typeof window.console !== 'undefined') {
				window.console.debug(message);
			}
		}
	},
	
	/* Template helpers */
	helpers: {
		/* Replaced in init */
	},
	
	/* Utils */
	utils: {
		regex: {
			sip: {
				username: "([0-9a-zA-Z-_.!~*'()&=+$,;?/]+)",
				domain: "([0-9a-zA-Z.-]+)",
				complete: "([0-9a-zA-Z-_.!~*'()&=+$,;?/]+)@([0-9a-zA-Z.-]+)"
			}
		},
		getAddress: function(base, uri) {
			var core = linphone.ui.getCore(base);
			return core.interpretUrl(uri);
		},
		getUsername: function(base, object) {
			var address;
			if (typeof object === 'string') {
				var core = linphone.ui.getCore(base);
				address = core.newAddress(object);
			} else {
				address = object;
			}
			if(!address) {
				return String(object);
			}
			var displayName = address.displayName;
			if(displayName) {
				return displayName;
			}
			var username = address.username;
			if(username) {
				return username;
			}
			return 'Unknown';
		},
		getAvatar: function(base, object) {
			return 'tmp/marcel.jpg';
		},
		getMainProxyConfig: function(base) {
			var proxy = null;
			if(linphone.ui.core.isRunning(base)) {
				var core = linphone.ui.getCore(base);
				proxy = core.defaultProxy;
			}
			return proxy;
		}
	}
};