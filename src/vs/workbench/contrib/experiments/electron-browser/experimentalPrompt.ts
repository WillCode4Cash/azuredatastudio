/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { INotificationService, Severity, IPromptChoice } from 'vs/platform/notification/common/notification';
import { IExperimentService, IExperiment, ExperimentActionType, IExperimentActionPromptProperties, IExperimentActionPromptCommand, ExperimentState } from 'vs/workbench/contrib/experiments/node/experimentService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IExtensionsViewlet } from 'vs/workbench/contrib/extensions/common/extensions';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { Disposable, IDisposable, dispose } from 'vs/base/common/lifecycle';
import { language } from 'vs/base/common/platform';

export class ExperimentalPrompts extends Disposable implements IWorkbenchContribution {
	private _disposables: IDisposable[] = [];

	constructor(
		@IExperimentService private readonly experimentService: IExperimentService,
		@IViewletService private readonly viewletService: IViewletService,
		@INotificationService private readonly notificationService: INotificationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService

	) {
		super();
		this.experimentService.onExperimentEnabled(e => {
			if (e.action && e.action.type === ExperimentActionType.Prompt && e.state === ExperimentState.Run) {
				this.showExperimentalPrompts(e);
			}
		}, this, this._disposables);
	}

	private showExperimentalPrompts(experiment: IExperiment): void {
		if (!experiment || !experiment.enabled || !experiment.action || experiment.state !== ExperimentState.Run) {
			return;
		}

		const logTelemetry = (commandText?: string) => {
			/* __GDPR__
				"experimentalPrompts" : {
					"experimentId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
					"commandText": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
					"cancelled": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
				}
			*/
			this.telemetryService.publicLog('experimentalPrompts', {
				experimentId: experiment.id,
				commandText,
				cancelled: !commandText
			});
		};

		const actionProperties = (<IExperimentActionPromptProperties>experiment.action.properties);
		const promptText = ExperimentalPrompts.getLocalizedText(actionProperties.promptText, language || '');
		if (!actionProperties || !promptText) {
			return;
		}
		if (!actionProperties.commands) {
			actionProperties.commands = [];
		}

		const choices: IPromptChoice[] = actionProperties.commands.map((command: IExperimentActionPromptCommand) => {
			const commandText = ExperimentalPrompts.getLocalizedText(command.text, language || '');
			return {
				label: commandText,
				run: () => {
					logTelemetry(commandText);
					if (command.externalLink) {
						window.open(command.externalLink);
					} else if (command.curatedExtensionsKey && Array.isArray(command.curatedExtensionsList)) {
						this.viewletService.openViewlet('workbench.view.extensions', true)
							.then(viewlet => viewlet as IExtensionsViewlet)
							.then(viewlet => {
								if (viewlet) {
									viewlet.search('curated:' + command.curatedExtensionsKey);
								}
							});
					}

					this.experimentService.markAsCompleted(experiment.id);

				}
			};
		});

		this.notificationService.prompt(Severity.Info, promptText, choices, {
			onCancel: () => {
				logTelemetry();
				this.experimentService.markAsCompleted(experiment.id);
			}
		});
	}

	dispose() {
		this._disposables = dispose(this._disposables);
	}

	static getLocalizedText(text: string | { [key: string]: string }, displayLanguage: string): string {
		if (typeof text === 'string') {
			return text;
		}
		const msgInEnglish = text['en'] || text['en-us'];
		displayLanguage = displayLanguage.toLowerCase();
		if (!text[displayLanguage] && displayLanguage.indexOf('-') === 2) {
			displayLanguage = displayLanguage.substr(0, 2);
		}
		return text[displayLanguage] || msgInEnglish;
	}
}
