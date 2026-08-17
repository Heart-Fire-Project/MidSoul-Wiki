import React, { useRef, type ComponentProps } from 'react';
import type { MDXComponents as MDXComponentMap } from 'mdx/types';
import MDXComponents from '@theme-original/MDXComponents';
import Callout from '../components/Callout';
import ColorTable from '../components/ColorTable';
import DataTable, { useScrollAffordance } from '../components/DataTable';
import Label from '../components/Label';

function ScrollableTable(props: ComponentProps<'table'>) {
	const scrollRef = useRef<HTMLDivElement>(null);
	useScrollAffordance(scrollRef);
	return <div ref={scrollRef} className="ms-table-scroll" role="region" aria-label="可横向滚动的表格" tabIndex={0}><table {...props} /></div>;
}

export default {
	...MDXComponents,
	table: ScrollableTable,
	Callout,
	ColorTable,
	DataTable,
	Label,
} satisfies MDXComponentMap;
