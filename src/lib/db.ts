import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Settings } from './entities/Settings';
import { User } from './entities/User';
import { LoginEvent } from './entities/LoginEvent';
import { AppConfig } from './entities/AppConfig';
import { Request } from './entities/Request';
import { Addon } from './entities/Addon';
import { TmdbImdbMap } from './entities/TmdbImdbMap';

const DB_PATH = 'config/watcherr.sqlite';

class TypeOrm {
	private static instance: Promise<DataSource | null> | null = null;

	private constructor() {
		// Private constructor to prevent external instantiation
	}

	public static getDb(): Promise<DataSource | null> {
		if (!TypeOrm.instance) {
			TypeOrm.instance = new DataSource({
				type: 'sqlite',
				database: DB_PATH,
				synchronize: true,
				entities: [Settings, User, LoginEvent, AppConfig, Request, Addon, TmdbImdbMap],
				logging: true
			})
				.initialize()
				.then((fulfilled) => {
					console.info('Data Source has been initialized!');
					return fulfilled;
				})
				.catch((err) => {
					console.error('Error during Data Source initialization', err);
					return null;
				});
		}
		return TypeOrm.instance;
	}
}

export default TypeOrm;
