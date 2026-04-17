import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	PrimaryColumn
} from 'typeorm';

@Entity({ name: 'tmdb_imdb_map' })
export class TmdbImdbMap extends BaseEntity {
	@PrimaryColumn('integer')
	tmdbId!: number;

	@PrimaryColumn('text')
	type!: 'movie' | 'series';

	@Column('text', { nullable: true })
	imdbId!: string | null;

	@CreateDateColumn()
	cachedAt!: Date;
}
