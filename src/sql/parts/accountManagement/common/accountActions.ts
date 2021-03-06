/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import { Event, Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';

import { error } from 'sql/base/common/log';
import { IAccountManagementService } from 'sql/platform/accountManagement/common/interfaces';
import { IDialogService, IConfirmation } from 'vs/platform/dialogs/common/dialogs';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';

/**
 * Actions to add a new account
 */
export class AddAccountAction extends Action {
	// CONSTANTS ///////////////////////////////////////////////////////////
	public static ID = 'account.addLinkedAccount';
	public static LABEL = localize('addAccount', 'Add an account');

	// EVENTING ////////////////////////////////////////////////////////////
	private _addAccountCompleteEmitter: Emitter<void>;
	public get addAccountCompleteEvent(): Event<void> { return this._addAccountCompleteEmitter.event; }

	private _addAccountErrorEmitter: Emitter<string>;
	public get addAccountErrorEvent(): Event<string> { return this._addAccountErrorEmitter.event; }

	private _addAccountStartEmitter: Emitter<void>;
	public get addAccountStartEvent(): Event<void> { return this._addAccountStartEmitter.event; }

	constructor(
		private _providerId: string,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		super(AddAccountAction.ID, AddAccountAction.LABEL);
		this.class = 'add-linked-account-action';

		this._addAccountCompleteEmitter = new Emitter<void>();
		this._addAccountErrorEmitter = new Emitter<string>();
		this._addAccountStartEmitter = new Emitter<void>();
	}

	public run(): Promise<boolean> {
		let self = this;

		// Fire the event that we've started adding accounts
		this._addAccountStartEmitter.fire();

		return new Promise((resolve, reject) => {
			self._accountManagementService.addAccount(self._providerId)
				.then(
				() => {
					self._addAccountCompleteEmitter.fire();
					resolve(true);
				},
				err => {
					error(`Error while adding account: ${err}`);
					self._addAccountErrorEmitter.fire(err);
					self._addAccountCompleteEmitter.fire();
					reject(err);
				}
				);
		});
	}
}

/**
 * Actions to remove the account
 */
export class RemoveAccountAction extends Action {
	public static ID = 'account.removeAccount';
	public static LABEL = localize('removeAccount', 'Remove account');

	constructor(
		private _account: azdata.Account,
		@IDialogService private _dialogService: IDialogService,
		@INotificationService private _notificationService: INotificationService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		super(RemoveAccountAction.ID, RemoveAccountAction.LABEL, 'remove-account-action icon remove');
	}

	public run(): Promise<boolean> {
		let self = this;

		// Ask for Confirm
		let confirm: IConfirmation = {
			message: localize('confirmRemoveUserAccountMessage', "Are you sure you want to remove '{0}'?", this._account.displayInfo.displayName),
			primaryButton: localize('accountActions.yes', 'Yes'),
			secondaryButton: localize('accountActions.no', 'No'),
			type: 'question'
		};

		return this._dialogService.confirm(confirm).then(result => {
			if (!result) {
				return Promise.resolve(false);
			} else {
				return new Promise((resolve, reject) => {
					self._accountManagementService.removeAccount(self._account.key)
						.then(
						(result) => { resolve(result); },
						(err) => {
							// Must handle here as this is an independent action
							self._notificationService.notify({
								severity: Severity.Error,
								message: localize('removeAccountFailed', 'Failed to remove account')
							});
							resolve(false);
						}
						);
				});
			}
		});
	}
}

/**
 * Actions to apply filter to the account
 */
export class ApplyFilterAction extends Action {
	public static ID = 'account.applyFilters';
	public static LABEL = localize('applyFilters', 'Apply Filters');

	constructor(
		id: string,
		label: string
	) {
		super(id, label, 'apply-filters-action icon filter');
	}

	public run(): Promise<boolean> {
		// Todo: apply filter to the account
		return Promise.resolve(true);
	}
}

/**
 * Actions to refresh the account
 */
export class RefreshAccountAction extends Action {
	public static ID = 'account.refresh';
	public static LABEL = localize('refreshAccount', 'Reenter your credentials');
	public account: azdata.Account;

	constructor(
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		super(RefreshAccountAction.ID, RefreshAccountAction.LABEL, 'refresh-account-action icon refresh');
	}
	public run(): Promise<boolean> {
		let self = this;
		return new Promise((resolve, reject) => {
			if (self.account) {
				self._accountManagementService.refreshAccount(self.account)
					.then(
					() => {
						resolve(true);
					},
					err => {
						error(`Error while refreshing account: ${err}`);
						reject(err);
					}
					);
			} else {
				let errorMessage = localize('NoAccountToRefresh', 'There is no account to refresh');
				reject(errorMessage);
			}
		});
	}
}
