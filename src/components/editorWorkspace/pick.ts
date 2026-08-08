/*
  浏览器文件选择器同一时刻只能开一个。取消是正常流程，其他异常继续向调用方抛出。
*/
let busy = false;

export async function pick<T>(open: () => Promise<T>): Promise<T | null> {
  if (busy) return null;
  busy = true;
  try {
    return await open();
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'AbortError') return null;
    throw caught;
  } finally {
    busy = false;
  }
}
