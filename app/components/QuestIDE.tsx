import * as React from 'react';
import {Tab} from 'material-ui/Tabs';
var ManualTabs: any = (require('./base/ManualTabs') as any).default;
import TextView from './base/TextView';
import {CodeViewType} from '../actions/ActionTypes';

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column"
  },
  tabsroot: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column'
  },
  tabcontainer: {
    overflowY: 'auto',
    height: "100%"
  }
};

console.log(ManualTabs);

const QuestIDE = ({ dirty, text, error, tab, onTabChange, onDirty, onErrorClose }: any): JSX.Element => {
  return (
    <span style={{width: "100%", height: "100%"}}>
      <ManualTabs style={styles.tabsroot}
          onChangeAttempt={onTabChange}
          value={tab}>
        <Tab label="Markdown" value={'MARKDOWN'}/>
        <Tab label="XML View" value={'XML'}/>
      </ManualTabs>
      <div style={styles.tabcontainer}>
        <TextView
          mode={tab.toLowerCase()}
          value={text}
          onChange={(text: string) => onDirty(dirty, text)} />
      </div>
    </span>
  );
}

export default QuestIDE;
