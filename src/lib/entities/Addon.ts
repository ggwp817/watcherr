import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn
} from 'typeorm';

@Entity({ name: 'addons' })
@Index(['enabled', 'sortOrder'])
export class Addon extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column('text')
	name!: string;

	@Index({ unique: true })
	@Column('text')
	manifestUrl!: string;

	@Column('text')
	baseUrl!: string;

	@Column('simple-json')
	manifest!: Record<string, unknown>;

	@Column('simple-array')
	resources!: string[];

	@Column('simple-array')
	types!: string[];

	@Column('boolean', { default: true })
	enabled!: boolean;

	@Column('integer', { default: 0 })
	sortOrder!: number;

	@CreateDateColumn()
	createdAt!: Date;

	@Column('datetime', { nullable: true })
	lastCheckedAt!: Date | null;
}
