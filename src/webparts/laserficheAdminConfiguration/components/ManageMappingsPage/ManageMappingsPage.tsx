import * as React from 'react';
import { SPHttpClient, ISPHttpClientOptions } from '@microsoft/sp-http';
import {
  DeleteModal,
  ProfileConfiguration,
} from '../ProfileConfigurationComponents';
import { ChangeEvent, useState } from 'react';
import { IManageMappingsPageProps } from './IManageMappingsPageProps';
import { IListItem } from '../IListItem';
import {
  ADMIN_CONFIGURATION_LIST,
  MANAGE_CONFIGURATIONS,
  MANAGE_MAPPING,
} from '../../../constants';
import { getSPListURL } from '../../../../Utils/Funcs';
import { ProfileMappingConfiguration } from '../../../../Utils/Types';
require('../../../../Assets/CSS/bootstrap.min.css');
require('../../adminConfig.css');
require('../../../../../node_modules/bootstrap/dist/js/bootstrap.min.js');

interface SPContentType {
  ID: string;
  Name: string;
  Description: string;
}

const mappingValidation =
  'Please ensure all mappings have a SharePoint Content Type and Laserfiche Profile';
const validationOf = 'Please ensure all SharePoint Content Types are unique.';

export default function ManageMappingsPage(props: IManageMappingsPageProps) {
  const [mappingRows, setMappingRows] = useState<ProfileMappingConfiguration[]>(
    []
  );
  const [sharePointContentTypes, setSharePointContentTypes] = useState<
    string[]
  >([]);
  const [laserficheContentTypes, setLaserficheContentTypes] = useState<
    string[]
  >([]);
  const [deleteModal, setDeleteModal] = useState(undefined);
  const [validationMessage, setValidationMessage] = useState(undefined);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [originalState, setOriginalState] = useState<{
    id: string;
    value: string;
  }>();

  React.useEffect(() => {
    getAllMappingsAsync();
  }, [props.repoClient]);

  async function getAllMappingsAsync() {
    await getAllSharePointContentTypesAsync();
    await getAllLaserficheContentTypesAsync();
    const results: { id: string; mappings: ProfileMappingConfiguration[] } =
      await getManageMappingsAsync();
    const jsonREsults = JSON.stringify(results.mappings);
    setOriginalState({ id: results.id, value: jsonREsults });
    if (results != null) {
      if (results.mappings.length > 0) {
        setMappingRows(mappingRows.concat(results.mappings));
        setValidationMessage(undefined);
      }
    }
  }

  async function getAllLaserficheContentTypesAsync() {
    const array: string[] = [];
    const results: { id: string; configs: ProfileConfiguration[] } =
      await getManageConfigurationsAsync();
    const configs = results.configs;
    if (results != null) {
      if (configs.length > 0) {
        for (let i = 0; i < configs.length; i++) {
          array.push(configs[i].ConfigurationName);
        }
        setLaserficheContentTypes(array);
      }
    }
  }

  async function getManageConfigurationsAsync(): Promise<{
    id: string;
    configs: ProfileConfiguration[];
  }> {
    const array: IListItem[] = [];
    const restApiUrl = `${getSPListURL(
      props.context,
      ADMIN_CONFIGURATION_LIST
    )}/Items?$select=Id,Title,JsonValue&$filter=Title eq '${MANAGE_CONFIGURATIONS}'`;
    try {
      const res = await fetch(restApiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
      const results = await res.json();
      if (results.value.length > 0) {
        for (let i = 0; i < results.value.length; i++) {
          array.push(results.value[i]);
        }
        return { id: array[0].Id, configs: JSON.parse(array[0].JsonValue) };
      } else {
        return null;
      }
    } catch (error) {
      console.log('error occurred' + error);
    }
  }

  async function getAllSharePointContentTypesAsync() {
    const restApiUrl =
      props.context.pageContext.web.absoluteUrl + '/_api/web/contenttypes';
    try {
      const res = await fetch(restApiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
      const results = await res.json();
      const array: string[] = results.value.map(
        (contentType: SPContentType) => contentType.Name
      );
      array.sort((a, b) => (a > b ? 1 : -1));
      setSharePointContentTypes(array);
    } catch (error) {
      console.log('error occurred' + error);
    }
  }

  async function getManageMappingsAsync(): Promise<{
    id: string;
    mappings: ProfileMappingConfiguration[];
  }> {
    const array: IListItem[] = [];
    const restApiUrl = `${getSPListURL(
      props.context,
      ADMIN_CONFIGURATION_LIST
    )}/Items?$select=Id,Title,JsonValue&$filter=Title eq '${MANAGE_MAPPING}'`;
    try {
      const res = await fetch(restApiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
      const results = await res.json();
      if (results.value.length > 0) {
        for (let i = 0; i < results.value.length; i++) {
          array.push(results.value[i]);
        }
        return { id: array[0].Id, mappings: JSON.parse(array[0].JsonValue) };
      } else {
        return null;
      }
    } catch (error) {
      console.log('error occurred' + error);
    }
  }

  const addNewMapping = () => {
    const item = {
      SharePointContentType: 'Select',
      LaserficheContentType: 'Select',
      toggle: false,
    };
    setMappingRows([...mappingRows, item]);
  };

  const saveAllMappings = async () => {
    const newJsonValue = [...mappingRows];
    setValidationMessage(undefined);
  
    const spNames = new Set<string>();
    for (const mapping of newJsonValue) {
      if (
        mapping.SharePointContentType === 'Select' ||
        mapping.LaserficheContentType === 'Select'
      ) {
        // TODO should it let you save if you haven't selected anything?
        setValidationMessage(mappingValidation);
        return;
      }
      spNames.add(mapping.SharePointContentType);
    }
    if (spNames.size !== newJsonValue.length) {
      setValidationMessage(validationOf);
      return;
    }

    const restApiUrl = `${getSPListURL(
      props.context,
      ADMIN_CONFIGURATION_LIST
    )}/items(${originalState.id})`;
    const jsonObject = JSON.stringify(newJsonValue);
    const body: string = JSON.stringify({
      Title: MANAGE_MAPPING,
      JsonValue: jsonObject,
    });
    // TODO is it slightly different if it is a completely new list?
    const options: ISPHttpClientOptions = {
      headers: {
        Accept: 'application/json;odata=nometadata',
        'content-type': 'application/json;odata=nometadata',
        'odata-version': '',
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE',
      },
      body: body,
    };
    await props.context.spHttpClient.post(
      restApiUrl,
      SPHttpClient.configurations.v1,
      options
    );
    setOriginalState({ id: originalState.id, value: jsonObject });
    setHasChanges(false);
  };

  const removeSpecificMapping = (idx: number) => {
    const rows = [...mappingRows];
    const delModal = (
      <DeleteModal
        onCancel={closeModalUp}
        onConfirmDelete={() => removeRow(idx)}
        configurationName={rows[idx].SharePointContentType}
      />
    );
    setDeleteModal(delModal);
  };

  function removeRow(id: number) {
    const rows = [...mappingRows];
    rows.splice(id, 1);
    setMappingRows(rows);
    const newRowsString = JSON.stringify(rows);
    setHasChanges(originalState.value !== newRowsString);
    setValidationMessage(undefined);
    setDeleteModal(undefined);
  }

  const handleSPContentTypeChange = (
    event: ChangeEvent<HTMLSelectElement>,
    idx: number
  ) => {
    const item = {
      id: event.target.id,
      name: event.target.name,
      value: event.target.value,
    };
    const newRows = [...mappingRows];
    newRows[idx].SharePointContentType = item.value;
    setMappingRows(newRows);
    const newRowsString = JSON.stringify(newRows);
    setHasChanges(originalState.value !== newRowsString);
    setValidationMessage(undefined);
  };

  const handleLFProfileChange = (
    event: ChangeEvent<HTMLSelectElement>,
    idx: number
  ) => {
    const item = {
      id: event.target.id,
      name: event.target.name,
      value: event.target.value,
    };
    const newRows = [...mappingRows];
    newRows[idx].LaserficheContentType = item.value;
    setMappingRows(newRows);
    const newRowsString = JSON.stringify(newRows);
    setHasChanges(originalState.value !== newRowsString);
    setValidationMessage(undefined);
  };

  function closeModalUp() {
    setDeleteModal(undefined);
  }

  const sharePointContentTypesDisplay = sharePointContentTypes.map(
    (contentType) => (
      <option key={contentType} value={contentType}>
        {contentType}
      </option>
    )
  );
  const lfContentTypesDisplay = laserficheContentTypes.map((contentType) => (
    <option key={contentType} value={contentType}>
      {contentType}
    </option>
  ));
  const renderTableData = mappingRows.map((item, index) => {
    return (
      <tr id='addr0' key={`${item.SharePointContentType}${item.LaserficheContentType}`}>
        <td>
          <select
            name='SharePointContentType'
            className='custom-select'
            defaultValue={mappingRows[index].SharePointContentType}
            onChange={(e) => handleSPContentTypeChange(e, index)}
          >
            <option>Select</option>
            {sharePointContentTypesDisplay}
          </select>
          {/* have error message here */}
        </td>
        <td>
          <select
            name='LaserficheContentType'
            className='custom-select'
            defaultValue={mappingRows[index].LaserficheContentType}
            onChange={(e) => handleLFProfileChange(e, index)}
          >
            <option>Select</option>
            {lfContentTypesDisplay}
          </select>
        </td>
        <td className='text-center'>
          <a
            href='javascript:;'
            className='ml-3'
            onClick={() => removeSpecificMapping(index)}
          >
            <span className='material-icons'>delete</span>
          </a>
        </td>
      </tr>
    );
  });
  const viewSharePointContentTypes =
    props.context.pageContext.web.absoluteUrl + '/_layouts/15/mngctype.aspx';

  return (
    <>
      <div
        className='container-fluid p-3'
        style={{ maxWidth: '85%', marginLeft: '-26px' }}
      >
        <div className='p-3'>
          <div className='card rounded-0'>
            <div className='card-header d-flex justify-content-between'>
              <div>
                <h6 className='mb-0'>Content Type Mappings Laserfiche</h6>
              </div>
              <div>
                <a
                  href=''
                  onClick={() => window.open(viewSharePointContentTypes)}
                  target='_blank'
                >
                  View SharePoint Content Types
                </a>
              </div>
            </div>
            <div className='card-body'>
              <table className='table table-sm'>
                <thead>
                  <tr>
                    <th className='text-center' style={{ width: '45%' }}>
                      SharePoint Content Type
                    </th>
                    <th className='text-center' style={{ width: '45%' }}>
                      Laserfiche Profile
                    </th>
                    <th className='text-center' />
                  </tr>
                </thead>
                <tbody>{renderTableData}</tbody>
              </table>
              <button
                className='btn btn-primary pl-5 pr-5 float-right'
                onClick={addNewMapping}
              >
                Add
              </button>
            </div>

            {validationMessage && (
              <div id='sharePointValidationMapping' style={{ color: 'red' }}>
                <span>{validationMessage}</span>
              </div>
            )}
            <div className='card-footer bg-transparent'>
              <button
                className='btn btn-primary pl-5 pr-5 float-right'
                disabled={!hasChanges}
                onClick={saveAllMappings}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className='modal'
        id='deleteModal'
        hidden={!deleteModal}
        data-backdrop='static'
        data-keyboard='false'
      >
        {deleteModal}
      </div>
    </>
  );
}
