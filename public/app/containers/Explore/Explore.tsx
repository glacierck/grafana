import React from 'react';
import { hot } from 'react-hot-loader';
import colors from 'app/core/utils/colors';
import TimeSeries from 'app/core/time_series2';

import ElapsedTime from './ElapsedTime';
import Legend from './Legend';
import QueryRows from './QueryRows';
import Graph from './Graph';
import Table from './Table';
import TimePicker, { DEFAULT_RANGE } from './TimePicker';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { buildQueryOptions, ensureQueries, generateQueryKey, hasQuery } from './utils/query';
import { decodePathComponent } from 'app/core/utils/location_util';

function makeTimeSeriesList(dataList, options) {
  return dataList.map((seriesData, index) => {
    const datapoints = seriesData.datapoints || [];
    const responseAlias = seriesData.target;
    const query = options.targets[index].expr;
    const alias = responseAlias && responseAlias !== '{}' ? responseAlias : query;
    const colorIndex = index % colors.length;
    const color = colors[colorIndex];

    const series = new TimeSeries({
      datapoints,
      alias,
      color,
      unit: seriesData.unit,
    });

    return series;
  });
}

function parseInitialState(initial) {
  try {
    const parsed = JSON.parse(decodePathComponent(initial));
    return {
      queries: parsed.queries.map(q => q.query),
      range: parsed.range,
    };
  } catch (e) {
    console.error(e);
    return { queries: [], range: DEFAULT_RANGE };
  }
}

interface IExploreState {
  datasource: any;
  datasourceError: any;
  datasourceLoading: any;
  graphResult: any;
  latency: number;
  loading: any;
  queries: any;
  range: any;
  requestOptions: any;
  showingGraph: boolean;
  showingTable: boolean;
  tableResult: any;
}

// @observer
export class Explore extends React.Component<any, IExploreState> {
  datasourceSrv: DatasourceSrv;

  constructor(props) {
    super(props);
    const { range, queries } = parseInitialState(props.routeParams.initial);
    this.state = {
      datasource: null,
      datasourceError: null,
      datasourceLoading: true,
      graphResult: null,
      latency: 0,
      loading: false,
      queries: ensureQueries(queries),
      range: range || { ...DEFAULT_RANGE },
      requestOptions: null,
      showingGraph: true,
      showingTable: true,
      tableResult: null,
    };
  }

  async componentDidMount() {
    const datasource = await this.props.datasourceSrv.get();
    const testResult = await datasource.testDatasource();
    if (testResult.status === 'success') {
      this.setState({ datasource, datasourceError: null, datasourceLoading: false }, () => this.handleSubmit());
    } else {
      this.setState({ datasource: null, datasourceError: testResult.message, datasourceLoading: false });
    }
  }

  handleAddQueryRow = index => {
    const { queries } = this.state;
    const nextQueries = [
      ...queries.slice(0, index + 1),
      { query: '', key: generateQueryKey() },
      ...queries.slice(index + 1),
    ];
    this.setState({ queries: nextQueries });
  };

  handleChangeQuery = (query, index) => {
    const { queries } = this.state;
    const nextQuery = {
      ...queries[index],
      query,
    };
    const nextQueries = [...queries];
    nextQueries[index] = nextQuery;
    this.setState({ queries: nextQueries });
  };

  handleChangeTime = nextRange => {
    const range = {
      from: nextRange.from,
      to: nextRange.to,
    };
    this.setState({ range }, () => this.handleSubmit());
  };

  handleClickGraphButton = () => {
    this.setState(state => ({ showingGraph: !state.showingGraph }));
  };

  handleClickTableButton = () => {
    this.setState(state => ({ showingTable: !state.showingTable }));
  };

  handleRemoveQueryRow = index => {
    const { queries } = this.state;
    if (queries.length <= 1) {
      return;
    }
    const nextQueries = [...queries.slice(0, index), ...queries.slice(index + 1)];
    this.setState({ queries: nextQueries }, () => this.handleSubmit());
  };

  handleSubmit = () => {
    const { showingGraph, showingTable } = this.state;
    if (showingTable) {
      this.runTableQuery();
    }
    if (showingGraph) {
      this.runGraphQuery();
    }
  };

  async runGraphQuery() {
    const { datasource, queries, range } = this.state;
    if (!hasQuery(queries)) {
      return;
    }
    this.setState({ latency: 0, loading: true, graphResult: null });
    const now = Date.now();
    const options = buildQueryOptions({
      format: 'time_series',
      interval: datasource.interval,
      instant: false,
      range,
      queries: queries.map(q => q.query),
    });
    try {
      const res = await datasource.query(options);
      const result = makeTimeSeriesList(res.data, options);
      const latency = Date.now() - now;
      this.setState({ latency, loading: false, graphResult: result, requestOptions: options });
    } catch (error) {
      console.error(error);
      this.setState({ loading: false, graphResult: error });
    }
  }

  async runTableQuery() {
    const { datasource, queries, range } = this.state;
    if (!hasQuery(queries)) {
      return;
    }
    this.setState({ latency: 0, loading: true, tableResult: null });
    const now = Date.now();
    const options = buildQueryOptions({
      format: 'table',
      interval: datasource.interval,
      instant: true,
      range,
      queries: queries.map(q => q.query),
    });
    try {
      const res = await datasource.query(options);
      const tableModel = res.data[0];
      const latency = Date.now() - now;
      this.setState({ latency, loading: false, tableResult: tableModel, requestOptions: options });
    } catch (error) {
      console.error(error);
      this.setState({ loading: false, tableResult: null });
    }
  }

  request = url => {
    const { datasource } = this.state;
    return datasource.metadataRequest(url);
  };

  render() {
    const {
      datasource,
      datasourceError,
      datasourceLoading,
      graphResult,
      latency,
      loading,
      queries,
      range,
      requestOptions,
      showingGraph,
      showingTable,
      tableResult,
    } = this.state;
    const showingBoth = showingGraph && showingTable;
    const graphHeight = showingBoth ? '200px' : null;
    const graphButtonClassName = showingBoth || showingGraph ? 'btn m-r-1' : 'btn btn-inverse m-r-1';
    const tableButtonClassName = showingBoth || showingTable ? 'btn m-r-1' : 'btn btn-inverse m-r-1';
    return (
      <div className="explore">
        <div className="page-body page-full">
          <h2 className="page-sub-heading">Explore</h2>
          {datasourceLoading ? <div>Loading datasource...</div> : null}

          {datasourceError ? <div title={datasourceError}>Error connecting to datasource.</div> : null}

          {datasource ? (
            <div className="m-r-3">
              <div className="nav m-b-1 navbar">
                <div className="navbar-buttons">
                  <button className={graphButtonClassName} onClick={this.handleClickGraphButton}>
                    Graph
                  </button>
                  <button className={tableButtonClassName} onClick={this.handleClickTableButton}>
                    Table
                  </button>
                </div>
                <div className="navbar__spacer" />
                <TimePicker range={range} onChangeTime={this.handleChangeTime} />
                <div className="navbar-buttons">
                  <button type="submit" className="btn btn-primary" onClick={this.handleSubmit}>
                    <i className="fa fa-return" /> Run Query
                  </button>
                </div>
                {loading || latency ? <ElapsedTime time={latency} className="" /> : null}
              </div>
              <QueryRows
                queries={queries}
                request={this.request}
                onAddQueryRow={this.handleAddQueryRow}
                onChangeQuery={this.handleChangeQuery}
                onExecuteQuery={this.handleSubmit}
                onRemoveQueryRow={this.handleRemoveQueryRow}
              />
              <main className="m-t-2">
                {showingGraph ? (
                  <Graph data={graphResult} id="explore-1" options={requestOptions} height={graphHeight} />
                ) : null}
                {showingGraph ? <Legend data={graphResult} /> : null}
                {showingTable ? <Table data={tableResult} className="m-t-3" /> : null}
              </main>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

export default hot(module)(Explore);
