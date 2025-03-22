import React from 'react';

import { YggFrame, yggCategories } from './ygg-frame';

type YggSearchProps = {
  search: string;
  category: string;
};

export default class YggSearch extends React.Component<YggSearchProps, {}> {
  render(): JSX.Element {
    const { search, category } = this.props;
    return (
      <YggFrame
        url={`/engine/search?name=${encodeURIComponent(search)}&description=&file=&uploader=&category=2145&sub_category=${yggCategories[category] || ''}&do=search&order=desc&sort=seed`}
        style={{ width: '1280px', height: '720px' }}
      />
    );
  }
}
