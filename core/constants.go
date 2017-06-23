package core

import (
	"strings"
)

const (
	PAYLOAD_MANIFEST = "payload manifest"
	TAG_MANIFEST     = "tag manifest"

	MD4    = "md4"
	MD5    = "md5"
	SHA1   = "sha1"
	SHA224 = "sha224"
	SHA256 = "sha256"
	SHA384 = "sha384"
	SHA512 = "sha512"

	REQUIRED  = "required"
	OPTIONAL  = "optional"
	FORBIDDEN = "forbidden"
)

// ManifestTypes describe the recognized types of manifests that
// expect to find in BagIt bags.
const ManifestTypes []string = []string{
	PAYLOAD_MANIFEST,
	TAG_MANIFEST,
}

// HashAlgorithms describes the list of hash algorithms we support
// for calculating fixity digests.
const HashAlgorithms []string = []string{
	MD4,
	MD5,
	SHA1,
	SHA224,
	SHA256,
	SHA384,
	SHA512,
}

// RequirementTypes are the valid requirement type values in a
// BagIt profile description.
const RequirementTypes []string = []string{
	REQUIRED,
	OPTIONAL,
	FORBIDDEN,
}

// IsSupportedAlgorithm returns true if the algorithm alg is
// among those this library supports.
func IsSupportedAlgorithm(alg string) bool {
	return StringListContains(HashAlgorithms, strings.ToLower(alg))
}

// IsValidRequirementType returns true if reqType is a valid
// requirement type.
func IsValidRequirementType(reqType string) bool {
	return StringListContains(RequirementTypes, strings.ToLower(reqType))
}
