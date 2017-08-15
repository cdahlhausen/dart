package models

import (
	"github.com/jmoiron/sqlx"
	"time"
)

// File holds information about a file that easy-store has
// either bagged or uploaded.
type File struct {
	Id                int       `db:"id"`
	BagId             *int      `db:"bag_id"`
	Name              string    `db:"name"`
	Size              int64     `db:"size"`
	Md5               string    `db:"md5"`
	Sha256            string    `db:"sha256"`
	StorageURL        string    `db:"storage_url"`
	StoredAsPartOfBag bool      `db:"stored_as_part_of_bag"`
	ETag              string    `db:"etag"`
	StoredAt          time.Time `db:"stored_at"`
	CreatedAt         time.Time `db:"created_at"`
	UpdatedAt         time.Time `db:"updated_at"`
}

// PrimaryKey() returns this object's Id, to conform to the Model interface.
func (file *File) PrimaryKey() int {
	return file.Id
}

func (file *File) Validate() (bool, []error) {
	return true, nil
}

func (file *File) Save(db *sqlx.DB) (*File, error) {
	// Insert if Id is zero, otherwise update.
	// Return file with Id.
	return file, nil
}
