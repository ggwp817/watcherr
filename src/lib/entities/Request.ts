import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'requests' })
@Index(['tmdbId', 'type'])
export class Request extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Index()
	@Column('text')
	userId!: string;

	@Column('text')
	username!: string;

	@Column('integer')
	tmdbId!: number;

	@Column('text')
	type!: 'movie' | 'series';

	@Column('integer', { nullable: true })
	profileId!: number | null;

	@CreateDateColumn()
	requestedAt!: Date;
}
