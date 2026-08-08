import React, { type ComponentProps } from 'react';
import type { MDXComponents as MDXComponentMap } from 'mdx/types';
import MDXComponents from '@theme-original/MDXComponents';
import Callout from '../components/Callout';
import ColorTable from '../components/ColorTable';
import DataTable from '../components/DataTable';
import Label from '../components/Label';

function ScrollableTable(props: ComponentProps<'table'>) {
	return <div className="ms-table-scroll" role="region" aria-label="可横向滚动的表格" tabIndex={0}><table {...props} /></div>;
}

export default {
	...MDXComponents,
	table: ScrollableTable,
	Callout,
	ColorTable,
	DataTable,
	Label,
} satisfies MDXComponentMap;
