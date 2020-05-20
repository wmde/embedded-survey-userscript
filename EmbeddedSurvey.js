/*
 * Create an injectable element where you want the survey to appear, and include survey configuration with
 * an `injectInto` selecting this element.  The element will be replaced when the survey is displayed.
 *
 *   <div id="survey-inject-1" class="wmde-tw-template-survey-container" style="padding: 12px 16px 16px; background-color: #eaecf0;">
 *     {{int:wmde-tw-template-survey-nojs-notice}}
 *   </div>
 *
 * Use the URL query parameter "?forcesurvey=true" to show the survey regardless of your Do Not Track setting and
 * any previously submitted responses.
 *
 * TODO:
 *  - Move EmbeddedSurvey into module file.
 *  - Provide surveys in mediawiki-config or on-wiki.
 *  - Try to keep our config structure compatible with QuickSurveys, in case we can upstream EmbeddedSurvey to that extension.
 */
( function () {
	var surveyConfig = {
		surveys: [
			{
				injectInto: '#survey-inject-1',
				name: "wmde-tw-template-survey-prototype-1",
				question: 'wmde-tw-template-survey-prototype1-question',
				description: 'wmde-tw-template-survey-prototype1-description-message',
				answers: [
					'wmde-tw-template-survey-prototype1-answer-1a',
					'wmde-tw-template-survey-prototype1-answer-1b',
					'wmde-tw-template-survey-prototype1-answer-1c'
				]
			}
		]
	};

	/**
	 * Extend an object with extra properties.
	 *
	 * @ignore
	 * @param {Object} target Object to extend.
	 * @param {Object} mixin Properties to incorporate into the target.
	 */
	function extend( target, mixin ) {
		var key;
		for ( key in mixin ) {
			target[ key ] = mixin[ key ];
		}
	}

	/**
	 * Get edit count bucket name, based on the number of edits made.
	 *
	 * @param {number|null} editCount
	 * @return {string}
	 */
	function getEditCountBucket( editCount ) {
		if ( editCount >= 1000 ) {
			return '1000+ edits';
		}
		if ( editCount >= 100 ) {
			return '100-999 edits';
		}
		if ( editCount >= 5 ) {
			return '5-99 edits';
		}
		if ( editCount >= 1 ) {
			return '1-4 edits';
		}
		return '0 edits';
	}

	function getSurveyStorageKey( name ) {
		return 'wmde-tw-survey-' + name.replace( / /g, '-' );
	}

	function getSurveyToken( name ) {
		return mw.storage.get( getSurveyStorageKey( name ) );
	}

	function setSurveyToken( name, token ) {
		var storageId = getSurveyStorageKey( name );
		mw.storage.set( storageId, token );
	}

	function show() {
		/**
		 * @class EmbeddedSurvey
		 * @extends OO.ui.StackLayout
		 *
		 * @constructor
		 * @param {Object} config
		 */
		function EmbeddedSurvey( config ) {
			this.initialize( config );
		}

		OO.inheritClass( EmbeddedSurvey, OO.ui.StackLayout );

		extend( EmbeddedSurvey.prototype, {
			/**
			 * Specifies partials (sub-templates) for use by the widget
			 * @property {Object}
			 */
			templatePartials: {
				// eslint-disable-next-line no-jquery/no-parse-html-literal
				initialPanel: $(
					'<div>' +
					'<strong data-question></strong>' +
					'<p data-description></p>' +
					'<div class="survey-button-container"></div>' +
					'<div class="survey-footer" data-footer></div>' +
					'</div>'
				),
				// eslint-disable-next-line no-jquery/no-parse-html-literal
				finalPanel: $(
					'<div>' +
					'<strong data-finalHeading></strong>' +
					'<div class="survey-footer" data-footer></div>' +
					'</div>'
				)
			},
			/**
			 * A set of default options that are merged with config passed into the initialize function.
			 * This is likely to change so currently no options are documented.
			 * @cfg {Object} defaults Default options hash.
			 */
			defaults: {
				templateData: {
					finalHeading: mw.msg( 'wmde-tw-survey-thank-you-notice' ),
					footer: mw.message( 'ext-quicksurveys-survey-privacy-policy-default-text' ).parse()
				},
				PanelLayout: {
					expanded: false,
					framed: false,
					padded: true,
					classes: [ 'message content' ]
				},
				scrollable: false,
				expanded: false,
				classes: [ 'panel panel-inline visible ext-quick-survey-panel' ]
			},
			/**
			 * Initialise a widget.
			 *
			 * @param {Object} config
			 */
			initialize: function ( config ) {
				var event;

				this.config = config || {};
				$.extend( true, this.config, this.defaults );

				if ( config.survey.privacyPolicy ) {
					// eslint-disable-next-line mediawiki/msg-doc
					this.config.templateData.footer = mw.message( config.survey.privacyPolicy ).parse();
				}

				// setup initial panel
				this.initialPanel = this.widget( 'PanelLayout', 'initialPanel' );

				// setup final panel
				this.finalPanel = this.widget( 'PanelLayout', 'finalPanel' );

				// Set the buttons
				this.renderButtons();

				// setup stack
				EmbeddedSurvey.super.call( this, $.extend( {}, config, {
					items: [ this.initialPanel, this.finalPanel ]
				} ) );

				event = {
					beaconCapable: !!navigator.sendBeacon,
					surveySessionToken: this.config.surveySessionToken,
					pageviewToken: this.config.pageviewToken,
					surveyCodeName: this.config.survey.name,
					eventName: 'eligible'
				};

				if ( window.performance && performance.now ) {
					event.performanceNow = Math.round( performance.now() );
				}

				mw.eventLog.logEvent( 'QuickSurveyInitiation', event );
			},
			/**
			 * Render and append buttons (and a freeform input if set) to
			 * the initial panel
			 */
			renderButtons: function () {
				var $btnContainer = this.initialPanel.$element.find( '.survey-button-container' ),
					answers = this.config.survey.answers,
					answerCheckboxes,
					answerOptions,
					submitButton;

				answerOptions = answers.map( function ( answer ) {
					return {
						data: answer,
						label: mw.msg( answer )
					};
				} );
				answerCheckboxes = new OO.ui.CheckboxMultiselectInputWidget( {
					// eslint-disable-next-line mediawiki/msg-doc
					options: answerOptions
				} );

				answerCheckboxes.$element.appendTo( $btnContainer );

				submitButton = new OO.ui.ButtonWidget( {
					label: mw.msg( 'ext-quicksurveys-internal-freeform-survey-submit-button' ),
					flags: 'progressive'
				} );
				submitButton.$element.appendTo( $btnContainer );

				submitButton.connect( this, {
					click: [ 'onClickSubmitButton', answerCheckboxes ]
				} );
			},
			/**
			 * Make a brand spanking new OOUI widget from a template partial
			 *
			 * @param {string} widgetName a valid OOUI widget
			 * @param {string} [templatePartialName] name of a registered template partial
			 * @param {Object} [options] further options to be passed to the widget
			 * @return {*} OOUI widget instance
			 */
			widget: function ( widgetName, templatePartialName, options ) {
				var templateClone,
					template = this.templatePartials[ templatePartialName ],
					config = $.extend( {}, this.config[ widgetName ], options ),
					templateData = this.config.templateData;

				if ( template ) {
					templateClone = template.clone();
					templateClone.find( '[data-question]' ).text( templateData.question );
					templateClone.find( '[data-description]' ).text( templateData.description );
					templateClone.find( '[data-footer]' ).html( templateData.footer );
					templateClone.find( '[data-finalHeading]' ).text( templateData.finalHeading );
					config.$content = templateClone;
				}

				return new OO.ui[ widgetName ]( config );
			},
			/**
			 * Log the answer to Schema:QuickSurveysResponses
			 * See {@link https://meta.wikimedia.org/wiki/Schema:QuickSurveysResponses}
			 *
			 * @param {string} answer
			 * @return {jQuery.Deferred}
			 */
			log: function ( answer ) {
				var survey = this.config.survey,
					skin = mw.config.get( 'skin' ),
					// FIXME: remove this when SkinMinervaBeta is renamed to 'minerva-beta'.
					mobileMode = mw.config.get( 'wgMFMode' );

				// On mobile differentiate between minerva stable and beta
				// by appending 'beta' to 'minerva'
				if ( skin === 'minerva' && mobileMode === 'beta' ) {
					skin += mobileMode;
				}

				return mw.eventLog.logEvent( 'QuickSurveysResponses', {
					namespaceId: mw.config.get( 'wgNamespaceNumber' ),
					surveySessionToken: this.config.surveySessionToken,
					pageviewToken: this.config.pageviewToken,
					pageId: mw.config.get( 'wgArticleId' ),
					pageTitle: mw.config.get( 'wgPageName' ),
					surveyCodeName: survey.name,
					surveyResponseValue: answer,
					platform: 'web',
					skin: skin,
					isTablet: !this.config.isMobileLayout,
					userLanguage: mw.config.get( 'wgContentLanguage' ),
					isLoggedIn: !mw.user.isAnon(),
					editCountBucket: getEditCountBucket( mw.config.get( 'wgUserEditCount' ) ),
					countryCode: 'Unknown'
				} );
			},

			/**
			 * @param {OO.ui.CheckboxMultiselectInputWidget} checkboxes
			 * @private
			 */
			onClickSubmitButton: function ( checkboxes ) {
				var selections = checkboxes.getValue();

				this.submit( selections.join(',') );
			},

			/**
			 * Submit user's answer to the backend and show the next panel
			 *
			 * @param {string} answer
			 */
			submit: function ( answer ) {
				this.log( answer );
				/**
				 * @event dismiss fired when any of the buttons in the survey are selected.
				 */
				this.emit( 'dismiss' );
				this.setItem( this.finalPanel );
			}
		} );

		for ( var survey of surveyConfig.surveys ) {
			var root = $( survey.injectInto ),
				isMobileLayout = window.innerWidth <= 768,
				userToken = getSurveyToken( survey.name );

			if ( !root.length ) {
				continue;
			}

			if ( userToken === '~' &&
				!mw.util.getParamValue( 'forcesurvey' )
			) {
				root.html( mw.msg( 'wmde-tw-survey-thank-you-notice' ) );
			    continue;
			}

			if ( !userToken ) {
				// Generate a new token for each survey
				userToken = mw.user.generateRandomSessionId();
				setSurveyToken( survey.name, userToken );
			}

			var panel = new EmbeddedSurvey( {
				survey: survey,
				templateData: {
					// eslint-disable-next-line mediawiki/msg-doc
					question: mw.msg( survey.question ),
					// eslint-disable-next-line mediawiki/msg-doc
					description: survey.description ? mw.msg( survey.description ) : ''
				},
				surveySessionToken: mw.user.sessionId() + '-quicksurveys',
				pageviewToken: mw.user.getPageviewToken(),
				isMobileLayout: isMobileLayout
			} );

			panel.on( 'dismiss', function () {
				setSurveyToken( survey.name, '~' );
			} );
			// TODO: Move inline CSS to an external stylesheet.
			root.replaceWith( panel.$element.css( 'float', 'none' ) );
		}
	}

	function recordResponse( response ) {
		// TODO
	}

	function shouldDisplay() {
		if ( mw.util.getParamValue( 'forcesurvey' ) ) {
			return true;
		}

		if (
			/1|yes/.test( navigator.doNotTrack ) ||
			window.doNotTrack === '1'
		) {
			return 'wmde-tw-template-survey-dnt-notice';
		}

		return true;
	}

	function init() {
		mw.loader.using(
			[
				'ext.quicksurveys.lib',
				'mediawiki.cookie',
				'mediawiki.storage',
				'mediawiki.viewport',
				'mediawiki.experiments',
				'oojs-ui-core',
				'oojs-ui-widgets',
				'mediawiki.user',
				'mediawiki.Uri',
				'ext.eventLogging',
				'mediawiki.util'
			],
			show
		);
	}

	function showNotice( message ) {
		$( '.wmde-tw-template-survey-container' )
			.html( mw.msg( message ) );
	}

	$( function () {
	    var isDisplayed = shouldDisplay();

		if ( isDisplayed === true ) {
			init();
		} else {
			showNotice( isDisplayed );
		}
		// TODO: else, show placeholder and optional reason.
	} );
} )();
