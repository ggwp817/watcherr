import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'app_config' })
export class AppConfig extends BaseEntity {
	@PrimaryColumn('text')
	key!: string;

	@Column('text')
	value!: string;
}
