const { execSync } = require("child_process");

function createIds(count) {
  const ids = execSync(
    `elixir -r cuid2.ex -e "IO.puts(Enum.map_join(1..${count}, \\",\\", fn _ -> Stone.Cuid2.create_id() end))"`
  )
    .toString()
    .trim()
    .split(",");

  if (ids.length !== count) {
    console.warn(`Expected ${count} IDs, but received ${ids.length}`);
  }

  return ids.slice(0, count);
}

const info = (txt) => console.log(`# - ${txt}`);

const idToBigInt = (id, _, __, radix = 36) =>
  [...id.toString()].reduce(
    (r, v) => r * BigInt(radix) + BigInt(parseInt(v, radix)),
    0n
  );

const buildHistogram = (numbers, bucketCount = 20) => {
  const buckets = Array(bucketCount).fill(0);
  let counter = 1;
  const bucketLength = Math.ceil(
    Number(BigInt(36 ** 23) / BigInt(bucketCount))
  );

  for (const number of numbers) {
    if (counter % bucketLength === 0) console.log(number);

    const bucket = Math.floor(Number(number / BigInt(bucketLength)));
    if (counter % bucketLength === 0) console.log(bucket);

    buckets[bucket] += 1;
    counter++;
  }
  return buckets;
};

const createIdPool = async ({ max = 100000 } = {}) => {
  const set = new Set();
  const batchSize = 10000;

  while (set.size < max) {
    const remainingIds = max - set.size;
    const batch = createIds(Math.min(batchSize, remainingIds));
    batch.forEach((id) => set.add(id));
    if (set.size % 100000 === 0)
      console.log(`${Math.floor((set.size / max) * 100)}%`);
  }

  const ids = [...set].slice(0, max);
  const numbers = ids.map((x) => idToBigInt(x.substring(1)));
  const histogram = buildHistogram(numbers);
  return { ids, numbers, histogram };
};

module.exports.createIdPool = createIdPool;
module.exports.buildHistogram = buildHistogram;
module.exports.info = info;
module.exports.idToBigInt = idToBigInt;
