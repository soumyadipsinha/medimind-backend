export function parseMentions(comment) {
  const regex = /([@!#])\[(.*?)\]\((.*?)\)/g;
  const matches = [...comment.matchAll(regex)];

  const typeMap = {
    "@": "user",
    "!": "channel",
    "#": "task",
  };

  return matches.map((match) => ({
    type: typeMap[match[1]],
    name: match[2],
    id: match[3],
  }));
}


