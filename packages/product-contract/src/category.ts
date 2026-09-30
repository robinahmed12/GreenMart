export interface CategoryRef {
  readonly slug: string;
  readonly name: string;
  readonly sortOrder: number;
}

export interface Category extends CategoryRef {
  readonly productCount: number;
}

export interface CategoryFacet extends CategoryRef {
  readonly count: number;
}

export interface CategoryList {
  readonly data: Category[];
}