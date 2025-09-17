export async function create(/* opts */) {
  return {
    // Express middleware gerekiyorsa no-op
    expressMiddleware: function(/* options */) {
      return (_req, _res, next) => next();
    },
    // Bazı kodlar imza/header bekleyebilir – no-op geri ver
    signResponseHeaders: (headers = {}) => headers,
    generateHeaders: async (headers = {}) => headers,
    attach: function(/* options */) {
      return (_req, _res, next) => next();
    }
  };
}
export default { create };
