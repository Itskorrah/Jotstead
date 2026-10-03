import {it, expect} from 'vitest';
import {createStore} from '../src/lib/store';
import {createSeed} from '../src/lib/seed';
import {mkdtempSync} from 'node:fs'; import {tmpdir} from 'node:os'; import {join} from 'node:path';
it('persists restart, rejects stale writes and safely retries mutations',()=>{
 const file=join(mkdtempSync(join(tmpdir(),'jotstead-test-')),'test.sqlite');
 const s=createStore(file); const first=s.read(); const changed=createSeed(); changed.name='My home';
 const next=s.save(changed,first.revision,'mutation-one'); expect(next.revision).toBe(first.revision+1);
 expect(s.save(changed,first.revision,'mutation-one').revision).toBe(next.revision);
 expect(()=>s.save(changed,first.revision,'mutation-two')).toThrow(/conflict/);
 s.close(); const restarted=createStore(file); expect(restarted.read().data.name).toBe('My home'); expect(restarted.history('home').length).toBeGreaterThan(0); restarted.close();
});
