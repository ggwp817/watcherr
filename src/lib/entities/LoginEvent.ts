import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'login_events' })
export class LoginEvent extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column('text')
	username!: string;

	@Column('text')
	ip!: string;

	@Column('boolean')
	success!: boolean;

	@CreateDateColumn()
	createdAt!: Date;
}
