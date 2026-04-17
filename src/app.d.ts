declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				username: string;
				isAdmin: boolean;
				tokenVersion: number;
				mode: 'request' | 'online' | null;
			} | null;
		}

		interface PageData {
			user: App.Locals['user'];
		}
	}
}

export {};
