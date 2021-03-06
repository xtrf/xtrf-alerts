/*alers 0.0.5*/
(function() {
	var alertsModule = angular.module('xtrf.modules', ['ng', 'pascalprecht.translate']);

	alertsModule.factory('AlertsQueue', ['$translate', function($translate) {
		return function(initQueue) {
			var queue = initQueue || [];

			var publicMethods = {

				all: function() {
					return queue;
				},

				size: function() {
					return queue.length;
				},

				isEmpty: function() {
					return queue.length === 0;
				},

				clear: function() {
					queue.splice(0, queue.length);
				},

				close: function(index) {
					queue.splice(index, 1);
				},

				clearAllExceptPreserved: function() {
					queue = _.map(_.where(queue, { preserve: true }), function(alert) {
						delete alert.preserve;
						return alert;
					});
				}
			};

			_.each(['success', 'info', 'warning', 'danger'], function(type) {
				publicMethods[type] = createAlertMethod(type);
			});
			publicMethods.error = createAlertMethod('danger');

			function createAlertMethod(type) {
				return function(title, message, options) {
					if(typeof title === 'object') {
						push(type, withTitle(create(title.message, title.options), title.title, title.options));
					} else if(typeof message === 'object' || typeof message === 'undefined') {
						push(type, create(title, message));
					} else if(typeof title === 'string') {
						push(type, withTitle(create(message, options), title, options));
					}
				};
			}

			function filterOutClosableOfType(type) {
				return _.filter(queue, function(alert) {
					return !(alert.type === type && alert.closable === true);
				});
			}

			function push(type, alert) {
				queue = filterOutClosableOfType(type);
				alert.type = type;
				queue.push(alert);
				$('html, body').animate({ scrollTop: 0 }, 200);
			}

			function create(message, options) {
				var scope = {
					message: options && options.html ? message : $translate(message, options && options.translationData),
					closable: options && options.closable,
					preserve: options && options.preserve
				};

				if(options && options.alertScope) {
					$.extend(scope, options.alertScope);
				}

				return scope;
			}

			function withTitle(alert, title, options) {
				if(title) {
					alert.title = options && options.html ? title : $translate(title, options && options.translationData);
				}
				return alert;
			}

			return publicMethods;
		};
	}]);


	alertsModule.factory('GlobalAlertsQueues', ['AlertsQueue', function(AlertsQueue) {
		return function(queues) {
			var globalQueue = new AlertsQueue();
			var publicMethods = {
				clearAllExceptPreserved: function() {
					_.each(queues, function(queue) {
						queue.clearAllExceptPreserved();
					});
					globalQueue.clearAllExceptPreserved();
				},
				all: function() {
					return angular.copy(globalQueue.all());
				}
			};
			_.each(['success', 'info', 'warning', 'danger', 'error'], function(type) {
				publicMethods[type] = function(title, message, options) {
					_.each(queues, function(queue) {
						queue[type](title, message, options);
					});
					globalQueue[type](title, message, options);
				};
			});
			return publicMethods;
		};
	}]);


	alertsModule.factory('Alerts', ['AlertsQueue', 'GlobalAlertsQueues', function(AlertsQueue, GlobalAlertsQueues) {

		var queues = {};
		var globalQueue = new GlobalAlertsQueues(queues);

		var queueForContext = function(context) {
			if(typeof queues[context] !== 'object') {
				queues[context] = new AlertsQueue(globalQueue.all());
			}
			return queues[context];
		};

		return function(context) {
			context = context || 'all';
			return (context === 'all') ? globalQueue : queueForContext(context);
		};
	}]);


	alertsModule.directive('singleAlert', function($compile) {
		return {
			restrict: 'E',
			replace: true,
			scope: {
				alert: '=ngModel',
				index: '=',
				queue: '='
			},
			template: '<div class="alert alert-{{ alert.type }}" ng-class="{ \'closable\': alert.closable, \'with-title\': alert.title }"><p class="title" ng-if="alert.title">{{ alert.title }}</p><span class="alert-content"></span><button ng-if="alert.closable" ng-click="closeAlert(index)" class="close-alert" type="button">×</button></div>',
			link: function($scope, $element) {
				$element.find('.alert-content').html($scope.alert.message).show();

				$compile($element.find('.alert-content'))($scope);

				$scope.closeAlert = function(index) {
					$scope.queue.close(index);
				};
			}
		};
	});

	alertsModule.directive('alerts', ['Alerts', function(Alerts) {
		return {
			restrict: 'EA',
			template: '<div class="alerts" ng-repeat="alert in alerts.all()"><single-alert index="$index" ng-model="alert" queue="alerts"></single-alert></div>',
			scope: {
				context: '@context'
			},
			link: function($scope) {
				$scope.alerts = Alerts(_.isString($scope.context) && $scope.context || 'global');
			}
		};
	}]);


// clear alerts on every state change success (except alerts with preserve == true)
	alertsModule.run(['$rootScope', 'Alerts', function($rootScope, Alerts) {

		$rootScope.$on('$stateChangeSuccess', function() {
			Alerts('all').clearAllExceptPreserved();
		});

	}]);

})() ;