import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

/**
 * Small D1 binding for SQL/CAS tests, backed by real SQLite in memory.
 * Prepared statements and batches execute atomically; this does not emulate
 * Cloudflare transport latency, replication, billing or query-cost metadata.
 * Contract: https://developers.cloudflare.com/d1/worker-api/prepared-statements/
 */
export function makeTestDb({schemaPath=new URL('../drizzle/0000_online.sql',import.meta.url)}={}) {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  try {if(schemaPath!==null)sqlite.exec(readFileSync(schemaPath,'utf8'));}
  catch(error){sqlite.close();throw error;}
  const owner=Symbol('test D1 database');
  let batchId=0;

  const normalize=value=>{
    if(value===null||typeof value==='string'||typeof value==='number')return value;
    if(value instanceof ArrayBuffer)return new Uint8Array(value);
    if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
    throw new TypeError(`D1_TYPE_ERROR: unsupported binding type ${typeof value}`);
  };
  class Statement {
    constructor(sql,params=[]){this.sql=sql;this.params=params;this.owner=owner;}
    bind(...params){return new Statement(this.sql,params.map(normalize));}
    execute(){
      const start=performance.now();
      const before=sqlite.prepare('SELECT total_changes() AS n').get().n;
      const statement=sqlite.prepare(this.sql);
      const results=statement.columns().length
        ?statement.all(...this.params).map(row=>({...row}))
        :(statement.run(...this.params),[]);
      const changes=sqlite.prepare('SELECT total_changes() AS n').get().n-before;
      const lastRowId=sqlite.prepare('SELECT last_insert_rowid() AS id').get().id;
      return {success:true,results,meta:{changes,last_row_id:lastRowId,changed_db:changes>0,duration:performance.now()-start,rows_read:results.length,rows_written:changes,served_by:'local-node-sqlite-test-adapter'}};
    }
    async first(column){
      const row=this.execute().results[0]??null;
      if(row===null)return null;
      if(column===undefined)return row;
      if(!Object.hasOwn(row,column))throw new Error(`D1_COLUMN_NOTFOUND: ${column}`);
      return row[column];
    }
    async all(){return this.execute();}
    async run(){return this.execute();}
  }

  return {
    prepare(sql){if(typeof sql!=='string')throw new TypeError('SQL must be a string');return new Statement(sql);},
    async batch(statements){
      if(!Array.isArray(statements)||statements.some(s=>!(s instanceof Statement)||s.owner!==owner))throw new TypeError('batch requires statements from this database');
      const savepoint=`d1_test_batch_${++batchId}`;
      sqlite.exec(`SAVEPOINT ${savepoint}`);
      try {const results=statements.map(s=>s.execute());sqlite.exec(`RELEASE ${savepoint}`);return results;}
      catch(error){sqlite.exec(`ROLLBACK TO ${savepoint}`);sqlite.exec(`RELEASE ${savepoint}`);throw error;}
    },
    close(){sqlite.close();}
  };
}
