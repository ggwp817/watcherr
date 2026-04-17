import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'users' })
export class User extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Index({ unique: true })
	@Column('text')
	username!: string;

	@Column('text')
	passwordHash!: string;

	@Column('boolean', { default: false })
	isAdmin!: boolean;

	@Column('integer', { default: 0 })
	tokenVersion!: number;

	@Column('datetime', { nullable: true })
	lastLoginAt!: Date | null;

	@Column('text', { nullable: true })
	jellyfinUserId!: string | null;

	@Column('text', { nullable: true })
	jellyfinAuthToken!: string | null;

	@Column('simple-json', { nullable: true })
	preferences!: Record<string, unknown> | null;

	@Column('text', { nullable: true })
	mode!: 'request' | 'online' | null;
}
