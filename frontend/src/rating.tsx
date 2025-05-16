import React from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

type RatingProps = {
  value: number;
  type?: string;
  tmdbid?: number;
};

export default class Rating extends React.PureComponent<RatingProps, {}> {
  render(): JSX.Element {
    const { value, tmdbid, type } = this.props;
    const backgroundColor = value > 7 ? '#00bc8c' : (value > 4 ? '#f39c12' : '#e74c3c');
    let content = (
      <CircularProgressbar
        background
        value={value * 10}
        text={`${Math.round(value * 10)}`}
        backgroundPadding={6}
        styles={buildStyles({
          backgroundColor,
          textColor: '#111',
          pathColor: '#111',
          trailColor: 'rgba(0,0,0,0.2)',
          textSize: '40px',
        })}
      />
    );
    if (tmdbid && type) {
      content = <a href={`browser://https%3A%2F%2Fwww.themoviedb.org%2F${type}%2F${tmdbid}`}>{content}</a>;
    }
    return <div className="rating d-inline-block" title={`Note spectateurs ${(value * 10).toFixed(0)}%`}>{content}</div>;
  }
}
