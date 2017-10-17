package models

import (
	"encoding/json"
	"fmt"
	"github.com/APTrust/easy-store/bagit"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"github.com/kirves/go-form-it"
	"github.com/kirves/go-form-it/fields"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Bag struct {
	gorm.Model       `form_options:"skip"`
	Name             string
	Size             int64
	Files            []File    `form_options:"skip"`
	StorageURL       string    `form_options:"skip"`
	MetadataURL      string    `form_options:"skip"`
	RemoteIdentifier string    `form_options:"skip"`
	StoredAt         time.Time `form_options:"skip"`
}

type File struct {
	gorm.Model        `form_options:"skip"`
	BagID             int64
	Name              string
	Size              int64
	Md5               string    `form_options:"skip"`
	Sha256            string    `form_options:"skip"`
	StorageURL        string    `form_options:"skip"`
	StoredAsPartOfBag bool      `form_options:"skip"`
	ETag              string    `form_options:"skip"`
	StoredAt          time.Time `form_options:"skip"`
}

type BagItProfile struct {
	gorm.Model       `form_options:"skip"`
	Name             string
	Description      string
	JSON             string            `form_widget:"textarea"`
	DefaultTagValues []DefaultTagValue `form_options:"skip"`
}

func (profile *BagItProfile) Profile() (*bagit.BagItProfile, error) {
	bagItProfile := &bagit.BagItProfile{}
	err := json.Unmarshal([]byte(profile.JSON), bagItProfile)
	return bagItProfile, err
}

func (profile *BagItProfile) GetForm() (*forms.Form, error) {
	postUrl := fmt.Sprintf("/profile/new")
	if profile.ID > uint(0) {
		postUrl = fmt.Sprintf("/profile/%d/edit", profile.ID)
	}
	form := forms.BootstrapFormFromModel(*profile, forms.POST, postUrl)
	form.Field("JSON").AddCss("height", "300px")
	if profile.JSON == "" {
		return form, nil
	}
	profileDef, err := profile.Profile()
	if err != nil {
		return nil, err
	}

	// TODO: Move sort into BagItProfile object.
	sortedFileNames := make([]string, len(profileDef.TagFilesRequired))
	i := 0
	for relFilePath, _ := range profileDef.TagFilesRequired {
		sortedFileNames[i] = relFilePath
		i++
	}
	sort.Strings(sortedFileNames)

	// Remove the submit button from the end of the form,
	// add our new elements, and then replace the submit button
	// at the end.
	submitButton := form.Field("submit")
	form.RemoveElement("submit")

	for _, relFilePath := range sortedFileNames {
		fieldsInSet := make([]fields.FieldInterface, 0)
		mapOfRequiredTags := profileDef.TagFilesRequired[relFilePath]
		// TODO: Move sort into BagItProfile object.
		sortedTagNames := make([]string, len(mapOfRequiredTags))
		i := 0
		for tagname, _ := range mapOfRequiredTags {
			sortedTagNames[i] = tagname
			i++
		}
		sort.Strings(sortedTagNames)
		for _, tagname := range sortedTagNames {
			tagdef := mapOfRequiredTags[tagname]
			defaultTags := profile.GetDefaultTagValues(relFilePath, tagname)
			defaultValue := ""
			defaultTagId := uint(0)
			if len(defaultTags) > 0 {
				defaultValue = defaultTags[0].TagValue
				defaultTagId = defaultTags[0].ID
			}
			fieldName := fmt.Sprintf("%s|%s|%d", relFilePath, tagname, defaultTagId)
			fieldLabel := tagname

			formField := fields.TextField(fieldName)
			if len(tagdef.Values) > 0 {
				options := make(map[string][]fields.InputChoice)
				options[""] = make([]fields.InputChoice, len(tagdef.Values))
				for i, val := range tagdef.Values {
					options[""][i] = fields.InputChoice{Id: val, Val: val}
				}
				formField = fields.SelectField(fieldName, options)
			}
			formField.SetLabel(fieldLabel)
			formField.SetValue(defaultValue)
			fieldsInSet = append(fieldsInSet, formField)
		}
		// Unfortunately, go-form-it does not support fieldset legends
		fieldSetLabel := fields.StaticField("", fmt.Sprintf("Default values for %s", relFilePath))
		fieldSetLabel.AddClass("fieldset-header")
		form.Elements(fieldSetLabel)
		fieldSet := forms.FieldSet(relFilePath, fieldsInSet...)
		form.Elements(fieldSet)
	}
	form.Elements(submitButton)

	return form, nil
}

func (profile *BagItProfile) GetDefaultTagValues(tagFile, tagName string) []DefaultTagValue {
	defaults := make([]DefaultTagValue, 0)
	for _, dtv := range profile.DefaultTagValues {
		if dtv.TagFile == tagFile && dtv.TagName == tagName {
			defaults = append(defaults, dtv)
		}
	}
	return defaults
}

func (profile *BagItProfile) DecodeDefaultTagValues(data map[string][]string) []DefaultTagValue {
	values := make([]DefaultTagValue, 0)
	for key, value := range data {
		if !strings.Contains(key, "|") {
			continue
		}
		keyParts := strings.Split(key, "|")
		//tagFile, tagName, tagId
		dtv := DefaultTagValue{
			BagItProfileID: int64(profile.ID), // TODO: int64 or uint??
			TagFile:        keyParts[0],
			TagName:        keyParts[1],
			TagValue:       value[0],
		}
		id, _ := strconv.Atoi(keyParts[2])
		dtv.ID = uint(id)
		values = append(values, dtv)
	}
	return values
}

type DefaultTagValue struct {
	gorm.Model     `form_options:"skip"`
	BagItProfileID int64
	TagFile        string
	TagName        string
	TagValue       string
}

type AppSetting struct {
	gorm.Model `form_options:"skip"`
	Name       string
	Value      string
}

type Job struct {
	gorm.Model         `form_options:"skip"`
	BagID              int64     `form_options:"skip"`
	FileID             int64     `form_options:"skip"`
	WorkflowID         int64     `form_widget:"select"`
	WorkflowSnapshot   string    `form_options:"skip"`
	ScheduledStartTime time.Time `form_options:"skip"`
	StartedAt          time.Time `form_options:"skip"`
	FinishedAt         time.Time `form_options:"skip"`
	Pid                int       `form_options:"skip"`
	Outcome            string    `form_options:"skip"`
	CapturedOutput     string    `form_options:"skip"`
}

type StorageService struct {
	gorm.Model     `form_options:"skip"`
	Name           string
	Description    string
	Protocol       string `form_widget:"select"`
	URL            string
	BucketOrFolder string
	LoginName      string
	LoginPassword  string `form_widget:"password"`
	LoginExtra     string `form_widget:"password"`
}

type Tag struct {
	gorm.Model  `form_options:"skip"`
	BagID       int64 `form_widget:"select"`
	RelFilePath string
	Name        string
	Value       string
}

type Workflow struct {
	gorm.Model          `form_options:"skip"`
	Name                string
	Description         string
	SerializationFormat string `form_widget:"select"`
	BagItProfileID      int64  `form_widget:"select"`
	StorageServiceID    int64  `form_widget:"select"`
}
