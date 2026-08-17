import React from 'react';
import Content from '@theme-original/DocItem/Content';
import type ContentType from '@theme/DocItem/Content';
import type { WrapperProps } from '@docusaurus/types';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import HeadingIndex from '../../../components/HeadingIndex';

type Props = WrapperProps<typeof ContentType>;

/**
 * 长文档顶部铺一排锚点，省掉「进页面 → 滚 → 找」。
 *
 * 索引从 Docusaurus 已有的 toc 数据现算，不写进文档内容——docs/**\/*.md
 * 是 .tiptap.json 的导出产物，手写进去的东西会在下次用编辑器保存时被覆盖。
 * 这样新增文档也自动带上。
 */
export default function ContentWrapper(props: Props): React.ReactNode {
	const { toc } = useDoc();
	return (
		<>
			<HeadingIndex toc={toc} />
			<Content {...props} />
		</>
	);
}
