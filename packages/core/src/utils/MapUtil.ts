export class MapUtil {
  public static serialize<T>(map: Map<string, T>) {
    const obj: any = {}
    map.forEach((value, key) => {
      obj[key] = value
    })
    return obj
  }

  public static deserialize<T>(serialized: any) {
    const map = new Map<string, T>()
    for (const key in serialized) {
      map.set(key, serialized[key])
    }
    return map
  }
}
